import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import { PLAN_STAFF_LIMITS } from "./plan-features";

/**
 * lib/server/staff-helpers.ts
 *
 * Shared server-only helpers for the three Free Edition staff API routes
 * (app/api/staff/create, app/api/staff/update, app/api/staff/set-status),
 * migrated from `functions/src/userFunctions.ts` (Cloud Function callables
 * `onCreateStaffMember` / `onUpdateStaffMember` / `onSetStaffActiveStatus`
 * — Firebase Spark plan cannot deploy Cloud Functions, so this logic now
 * runs directly inside Next.js API routes, same pattern as
 * `app/api/super-admin/create-tenant` before it).
 *
 * Pulled into one shared file (rather than tripling the code across three
 * route handlers) because all three routes need the same tenant-admin
 * auth guard, and two of the three need the same staff-limit check and
 * all three write the same shape of audit log entry — duplicating that
 * business logic three times would risk the copies drifting apart.
 */

export const STAFF_ROLES = ["branch_manager", "commission_staff", "regular_staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export class StaffApiError extends Error {
  constructor(
    public readonly status: number,
    /** Matches the FirebaseError `.code` shape the client already checks
     *  for (e.g. "resource-exhausted", "already-exists") — see
     *  lib/firebase/users.ts, which maps these HTTP responses back into
     *  an Error with this same `.code` so
     *  components/tenant/users/staff-form-modal.tsx and
     *  toggle-staff-active-dialog.tsx keep working completely unchanged. */
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "StaffApiError";
  }
}

/**
 * Verifies the Authorization: Bearer <idToken> header and requires the
 * caller to be an active tenant_admin — exact same check as the original
 * Cloud Function's `requireTenantAdmin(context)`.
 */
export async function requireTenantAdmin(
  req: NextRequest,
  auth: Auth
): Promise<{ tenantId: string; uid: string }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new StaffApiError(401, "unauthenticated", "লগইন প্রয়োজন");
  }
  const idToken = authHeader.slice(7);

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    throw new StaffApiError(401, "unauthenticated", "লগইন প্রয়োজন");
  }

  if (decoded.role !== "tenant_admin" || decoded.isActive !== true) {
    throw new StaffApiError(
      403,
      "permission-denied",
      "শুধু প্রতিষ্ঠানের অ্যাডমিন স্টাফ ব্যবস্থাপনা করতে পারবেন"
    );
  }

  const tenantId = decoded.tenantId as string | undefined;
  if (!tenantId) {
    throw new StaffApiError(412, "failed-precondition", "টেন্যান্ট পাওয়া যায়নি");
  }

  return { tenantId, uid: decoded.uid };
}

export async function countActiveStaff(db: Firestore, tenantId: string): Promise<number> {
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

export async function getPlanLimit(db: Firestore, tenantId: string): Promise<number> {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenant = tenantSnap.data();
  if (!tenant) return 0;
  // Trial tenants run on the premium feature set (blueprint section 4.1)
  // → effectively unlimited staff during trial, same as a premium plan.
  if (tenant.isTrial === true) return PLAN_STAFF_LIMITS.premium;
  const planId = (tenant.planId as keyof typeof PLAN_STAFF_LIMITS) ?? "basic";
  return PLAN_STAFF_LIMITS[planId] ?? PLAN_STAFF_LIMITS.basic;
}

export async function writeUserAuditLog(
  db: Firestore,
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
    // Original Cloud Function value was "cloud-function" — updated to
    // reflect the new infrastructure. Metadata only, not a business rule.
    userAgent: "netlify-nextjs-api-route",
    createdAt: Timestamp.now(),
  });
}
