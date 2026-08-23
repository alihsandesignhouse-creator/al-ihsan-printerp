import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  STAFF_ROLES,
  StaffApiError,
  requireTenantAdmin,
  writeUserAuditLog,
} from "@/lib/server/staff-helpers";

/**
 * POST /api/staff/update
 *
 * Free Edition: replaces the Cloud Function callable `onUpdateStaffMember`
 * (`functions/src/userFunctions.ts`). See app/api/staff/create/route.ts's
 * header comment for the general migration rationale — same pattern here.
 *
 *   1. Verify caller is an active tenant_admin
 *   2. Validate the request body
 *   3. Load the target staff doc, confirm it belongs to this tenant
 *      (permission-denied otherwise — never trust a userId across tenants)
 *   4. If branchId given, verify that branch exists for this tenant
 *   5. Update the Firestore doc, re-set custom claims (keeping the
 *      existing isActive value — this route never changes isActive, that's
 *      /api/staff/set-status's job, exactly like the Cloud Function)
 *   6. Optionally update the Auth password
 *   7. Write a user.updated audit log entry
 *
 * No business rule was changed or dropped.
 */
export const runtime = "nodejs";

const updateStaffSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(80),
  role: z.enum(STAFF_ROLES),
  branchId: z.string().nullable(),
  commissionRate: z.number().min(0).max(100),
  newPassword: z.string().min(8).optional(),
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

  const parsed = updateStaffSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid-argument", message: "তথ্য সঠিক নয়", errors: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const userRef = db.collection("tenants").doc(tenantId).collection("users").doc(input.userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ code: "not-found", message: "স্টাফ পাওয়া যায়নি" }, { status: 404 });
  }
  const existing = userSnap.data();
  if (existing?.tenantId !== tenantId) {
    return NextResponse.json({ code: "permission-denied", message: "অনুমতি নেই" }, { status: 403 });
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

  const now = Timestamp.now();

  try {
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
      // Deliberately always false for staff (audit item #5, ৩০ জুলাই
      // ২০২৬ — see the identical comment in
      // app/api/staff/set-status/route.ts for the full reasoning: nothing
      // reads a staff member's OWN isTrial claim, so this is harmless,
      // just previously undocumented).
      isTrial: false,
      branchId: input.branchId,
    });

    if (input.newPassword) {
      await auth.updateUser(input.userId, { password: input.newPassword });
    }

    await writeUserAuditLog(db, tenantId, adminUid, "tenant_admin", "user.updated", input.userId, {
      name: input.name,
      role: input.role,
      branchId: input.branchId,
      passwordChanged: Boolean(input.newPassword),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[POST /api/staff/update]", err);
    }
    return NextResponse.json({ code: "internal", message: "স্টাফ আপডেট করা যায়নি" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
