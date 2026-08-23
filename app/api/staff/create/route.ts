import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  STAFF_ROLES,
  StaffApiError,
  countActiveStaff,
  getPlanLimit,
  requireTenantAdmin,
  writeUserAuditLog,
} from "@/lib/server/staff-helpers";

/**
 * POST /api/staff/create
 *
 * Free Edition: replaces the Cloud Function callable `onCreateStaffMember`
 * (`functions/src/userFunctions.ts`) — Firebase Spark plan cannot deploy
 * Cloud Functions. The exact same business logic now runs here via the
 * Admin SDK (`lib/firebase/admin.ts`):
 *
 *   1. Verify the caller's ID token (Authorization: Bearer header) and
 *      require an active tenant_admin (lib/server/staff-helpers.ts →
 *      requireTenantAdmin — server-side claim check, never client-trusted)
 *   2. Validate the request body (same zod rules as the Cloud Function)
 *   3. Enforce the plan's max-active-staff limit (blueprint section 4.3)
 *   4. If a branchId is given, verify that branch exists for this tenant
 *   5. Create the Firebase Auth user
 *   6. Write tenants/{tenantId}/users/{uid}, set custom claims, write a
 *      user.created audit log entry — rolling back the orphaned Auth user
 *      if any of these three fail (same as the Cloud Function's catch block)
 *
 * No business rule was changed or dropped — only the transport changed
 * (direct Admin SDK call in this route instead of an onCall Cloud
 * Function). The client (lib/firebase/users.ts) now calls this route with
 * fetch() + Bearer token instead of httpsCallable().
 */
export const runtime = "nodejs";

const createStaffSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(STAFF_ROLES),
  branchId: z.string().nullable(),
  commissionRate: z.number().min(0).max(100),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  let tenantId: string;
  let adminUid: string;
  try {
    ({ tenantId, uid: adminUid } = await requireTenantAdmin(req, auth));
  } catch (err) {
    if (err instanceof StaffApiError) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ code: "internal", message: "unknown" }, { status: 500 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ code: "invalid-argument", message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createStaffSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid-argument", message: "তথ্য সঠিক নয়", errors: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const [activeCount, limit] = await Promise.all([
    countActiveStaff(db, tenantId),
    getPlanLimit(db, tenantId),
  ]);
  if (activeCount >= limit) {
    return NextResponse.json(
      {
        code: "resource-exhausted",
        message: "আপনার প্যাকেজের স্টাফ সীমা শেষ হয়ে গেছে — আরও স্টাফ যোগ করতে প্যাকেজ আপগ্রেড করুন",
      },
      { status: 409 }
    );
  }

  if (input.branchId) {
    const branchSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("branches")
      .doc(input.branchId)
      .get();
    if (!branchSnap.exists) {
      return NextResponse.json({ code: "not-found", message: "শাখা পাওয়া যায়নি" }, { status: 404 });
    }
  }

  let uid: string;
  try {
    const userRecord = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
    });
    uid = userRecord.uid;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        { code: "already-exists", message: "এই Email ইতিমধ্যে ব্যবহৃত হয়েছে" },
        { status: 409 }
      );
    }
    return NextResponse.json({ code: "internal", message: "স্টাফ তৈরি করা যায়নি" }, { status: 500 });
  }

  const now = Timestamp.now();

  try {
    await db.collection("tenants").doc(tenantId).collection("users").doc(uid).set({
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
      // Deliberately always false for staff (audit item #5, ৩০ জুলাই
      // ২০২৬ — see the identical comment in
      // app/api/staff/set-status/route.ts for the full reasoning).
      isTrial: false,
      branchId: input.branchId,
    });

    await writeUserAuditLog(db, tenantId, adminUid, "tenant_admin", "user.created", uid, {
      name: input.name,
      role: input.role,
      branchId: input.branchId,
    });
  } catch (err) {
    // Roll back the orphaned Auth user if Firestore/claims setup failed —
    // same rollback the original Cloud Function performed.
    await auth.deleteUser(uid).catch(() => undefined);
    if (process.env.NODE_ENV !== "production") {
      console.error("[POST /api/staff/create]", err);
    }
    return NextResponse.json({ code: "internal", message: "স্টাফ তৈরি করা যায়নি" }, { status: 500 });
  }

  return NextResponse.json({ userId: uid }, { status: 201 });
}
