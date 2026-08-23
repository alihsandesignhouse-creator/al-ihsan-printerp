import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const REGION = "asia-south1";

// ─── Plan-based staff limits (blueprint section 4.3) — authoritative copy ──
const PLAN_STAFF_LIMITS: Record<string, number> = {
  basic: 3,
  standard: 10,
  premium: Infinity,
};

const STAFF_ROLES = ["branch_manager", "commission_staff", "regular_staff"] as const;

// ─── Validation ─────────────────────────────────────────────────────────

const createStaffSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(STAFF_ROLES),
  branchId: z.string().nullable(),
  commissionRate: z.number().min(0).max(100),
});

const updateStaffSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(80),
  role: z.enum(STAFF_ROLES),
  branchId: z.string().nullable(),
  commissionRate: z.number().min(0).max(100),
  newPassword: z.string().min(8).optional(),
});

const setActiveSchema = z.object({
  userId: z.string().min(1),
  isActive: z.boolean(),
});

// ─── Auth guard: caller must be an active tenant_admin ─────────────────────

function requireTenantAdmin(context: functions.https.CallableContext): {
  tenantId: string;
  uid: string;
} {
  const token = context.auth?.token;
  if (!context.auth || !token) {
    throw new functions.https.HttpsError("unauthenticated", "লগইন প্রয়োজন");
  }
  if (token.role !== "tenant_admin" || token.isActive !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "শুধু প্রতিষ্ঠানের অ্যাডমিন স্টাফ ব্যবস্থাপনা করতে পারবেন"
    );
  }
  const tenantId = token.tenantId as string | undefined;
  if (!tenantId) {
    throw new functions.https.HttpsError("failed-precondition", "টেন্যান্ট পাওয়া যায়নি");
  }
  return { tenantId, uid: context.auth.uid };
}

async function countActiveStaff(tenantId: string): Promise<number> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("users")
    .where("isActive", "==", true)
    .where("deletedAt", "==", null)
    .where("role", "in", [...STAFF_ROLES])
    .get();
  return snapshot.size;
}

async function getPlanLimit(tenantId: string): Promise<number> {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenant = tenantSnap.data();
  if (!tenant) return 0;
  // Trial tenants run on the premium feature set (blueprint section 4.1) →
  // effectively unlimited staff during trial, same as a premium plan.
  if (tenant.isTrial === true) return PLAN_STAFF_LIMITS.premium ?? Infinity;
  const planId = (tenant.planId as string) ?? "basic";
  return PLAN_STAFF_LIMITS[planId] ?? PLAN_STAFF_LIMITS.basic;
}

async function writeAuditLog(
  tenantId: string,
  userId: string,
  userEmail: string,
  action: string,
  resourceId: string,
  changes: Record<string, unknown>
): Promise<void> {
  const ref = db.collection("tenants").doc(tenantId).collection("audit_logs").doc();
  await ref.set({
    id: ref.id,
    tenantId,
    userId,
    userEmail,
    action,
    resourceType: "user",
    resourceId,
    changes,
    ipAddress: "",
    userAgent: "cloud-function",
    createdAt: admin.firestore.Timestamp.now(),
  });
}

// ─── Create staff member ───────────────────────────────────────────────────
// Creates a Firebase Auth user, sets custom claims, and writes the
// tenants/{tenantId}/users/{uid} document. Enforces the package's max-staff
// limit (blueprint section 4.3 / T-07: "সীমা ... Cloud Function-এ enforce").

export const onCreateStaffMember = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { tenantId, uid: adminUid } = requireTenantAdmin(context);

    const parsed = createStaffSchema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError("invalid-argument", "তথ্য সঠিক নয়", parsed.error.issues);
    }
    const input = parsed.data;

    const [activeCount, limit] = await Promise.all([
      countActiveStaff(tenantId),
      getPlanLimit(tenantId),
    ]);
    if (activeCount >= limit) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "আপনার প্যাকেজের স্টাফ সীমা শেষ হয়ে গেছে — আরও স্টাফ যোগ করতে প্যাকেজ আপগ্রেড করুন"
      );
    }

    if (input.branchId) {
      const branchSnap = await db
        .collection("tenants").doc(tenantId)
        .collection("branches").doc(input.branchId)
        .get();
      if (!branchSnap.exists) {
        throw new functions.https.HttpsError("not-found", "শাখা পাওয়া যায়নি");
      }
    }

    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await auth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        throw new functions.https.HttpsError("already-exists", "এই Email ইতিমধ্যে ব্যবহৃত হয়েছে");
      }
      throw new functions.https.HttpsError("internal", "স্টাফ তৈরি করা যায়নি");
    }

    const uid = userRecord.uid;
    const now = admin.firestore.Timestamp.now();

    try {
      await db
        .collection("tenants").doc(tenantId)
        .collection("users").doc(uid)
        .set({
          id: uid,
          tenantId,
          branchId: input.branchId,
          name: input.name,
          email: input.email,
          role: input.role,
          commissionRate: input.commissionRate,
          isActive: true,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });

      await auth.setCustomUserClaims(uid, {
        tenantId,
        role: input.role,
        isActive: true,
        isTrial: false,
        branchId: input.branchId,
      });

      await writeAuditLog(tenantId, adminUid, "tenant_admin", "user.created", uid, {
        name: input.name,
        role: input.role,
        branchId: input.branchId,
      });
    } catch (err) {
      // Roll back the orphaned Auth user if Firestore/claims setup failed.
      await auth.deleteUser(uid).catch(() => undefined);
      if (process.env.NODE_ENV !== "production") console.error("[onCreateStaffMember]", err);
      throw new functions.https.HttpsError("internal", "স্টাফ তৈরি করা যায়নি");
    }

    const result: { userId: string } = { userId: uid };
    return result;
  });

// ─── Update staff member ───────────────────────────────────────────────────

export const onUpdateStaffMember = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { tenantId, uid: adminUid } = requireTenantAdmin(context);

    const parsed = updateStaffSchema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError("invalid-argument", "তথ্য সঠিক নয়", parsed.error.issues);
    }
    const input = parsed.data;

    const userRef = db.collection("tenants").doc(tenantId).collection("users").doc(input.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "স্টাফ পাওয়া যায়নি");
    }
    const existing = userSnap.data();
    if (existing?.tenantId !== tenantId) {
      throw new functions.https.HttpsError("permission-denied", "অনুমতি নেই");
    }

    if (input.branchId) {
      const branchSnap = await db
        .collection("tenants").doc(tenantId)
        .collection("branches").doc(input.branchId)
        .get();
      if (!branchSnap.exists) {
        throw new functions.https.HttpsError("not-found", "শাখা পাওয়া যায়নি");
      }
    }

    const now = admin.firestore.Timestamp.now();

    await userRef.update({
      name: input.name,
      role: input.role,
      branchId: input.branchId,
      commissionRate: input.commissionRate,
      updatedAt: now,
    });

    await auth.setCustomUserClaims(input.userId, {
      tenantId,
      role: input.role,
      isActive: existing?.isActive === true,
      isTrial: false,
      branchId: input.branchId,
    });

    if (input.newPassword) {
      await auth.updateUser(input.userId, { password: input.newPassword });
    }

    await writeAuditLog(tenantId, adminUid, "tenant_admin", "user.updated", input.userId, {
      name: input.name,
      role: input.role,
      branchId: input.branchId,
      passwordChanged: Boolean(input.newPassword),
    });

    const result: { success: true } = { success: true };
    return result;
  });

// ─── Activate / deactivate staff ──────────────────────────────────────────
// Deactivating sets the Auth custom claim isActive:false, which blocks
// login (blueprint section 13.2). Reactivating re-checks the plan's
// staff-limit so a tenant can't bypass the cap via deactivate→reactivate.

export const onSetStaffActiveStatus = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { tenantId, uid: adminUid } = requireTenantAdmin(context);

    const parsed = setActiveSchema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError("invalid-argument", "তথ্য সঠিক নয়", parsed.error.issues);
    }
    const input = parsed.data;

    const userRef = db.collection("tenants").doc(tenantId).collection("users").doc(input.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "স্টাফ পাওয়া যায়নি");
    }
    const existing = userSnap.data();
    if (existing?.tenantId !== tenantId) {
      throw new functions.https.HttpsError("permission-denied", "অনুমতি নেই");
    }

    if (input.isActive) {
      const [activeCount, limit] = await Promise.all([
        countActiveStaff(tenantId),
        getPlanLimit(tenantId),
      ]);
      if (activeCount >= limit) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "আপনার প্যাকেজের স্টাফ সীমা শেষ হয়ে গেছে — সক্রিয় করা যাচ্ছে না"
        );
      }
    }

    const now = admin.firestore.Timestamp.now();
    await userRef.update({ isActive: input.isActive, updatedAt: now });

    await auth.setCustomUserClaims(input.userId, {
      tenantId,
      role: existing?.role as string,
      isActive: input.isActive,
      isTrial: false,
      branchId: (existing?.branchId as string | null) ?? null,
    });

    await writeAuditLog(
      tenantId,
      adminUid,
      "tenant_admin",
      input.isActive ? "user.activated" : "user.deactivated",
      input.userId,
      { isActive: input.isActive }
    );

    const result: { success: true } = { success: true };
    return result;
  });
