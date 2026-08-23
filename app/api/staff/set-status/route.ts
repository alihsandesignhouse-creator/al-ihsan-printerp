import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  StaffApiError,
  countActiveStaff,
  getPlanLimit,
  requireTenantAdmin,
  writeUserAuditLog,
} from "@/lib/server/staff-helpers";

/**
 * POST /api/staff/set-status
 *
 * Free Edition: replaces the Cloud Function callable
 * `onSetStaffActiveStatus` (`functions/src/userFunctions.ts`). See
 * app/api/staff/create/route.ts's header comment for the general
 * migration rationale — same pattern here.
 *
 * Deactivating sets the Auth custom claim isActive:false, which blocks
 * login (blueprint section 13.2). Reactivating re-checks the plan's
 * staff-limit so a tenant can't bypass the cap via deactivate→reactivate
 * — exactly the same guard as the original Cloud Function.
 *
 * No business rule was changed or dropped.
 */
export const runtime = "nodejs";

const setActiveSchema = z.object({
  userId: z.string().min(1),
  isActive: z.boolean(),
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

  const parsed = setActiveSchema.safeParse(rawBody);
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

  if (input.isActive) {
    const [activeCount, limit] = await Promise.all([
      countActiveStaff(db, tenantId),
      getPlanLimit(db, tenantId),
    ]);
    if (activeCount >= limit) {
      return NextResponse.json(
        {
          code: "resource-exhausted",
          message: "আপনার প্যাকেজের স্টাফ সীমা শেষ হয়ে গেছে — সক্রিয় করা যাচ্ছে না",
        },
        { status: 409 }
      );
    }
  }

  try {
    const now = Timestamp.now();
    await userRef.update({ isActive: input.isActive, updatedAt: now });

    await auth.setCustomUserClaims(input.userId, {
      tenantId,
      role: existing?.role as string,
      isActive: input.isActive,
      // Deliberately always false for staff, regardless of the tenant's
      // own isTrial state (audit item #5, ৩০ জুলাই ২০২৬ — flagged as an
      // unexplained inconsistency; documenting the reasoning here instead
      // of changing behavior). Nothing currently reads a staff member's
      // OWN isTrial claim: firestore.rules/middleware.ts only ever check
      // `isActive`, and the trial banner (T-01, app/(tenant)/layout.tsx)
      // reads the *tenant document's* isTrial field directly, not the
      // logged-in user's claim. Same convention followed by
      // lib/server/tenant-claims-sync.ts.
      isTrial: false,
      branchId: (existing?.branchId as string | null) ?? null,
    });

    await writeUserAuditLog(
      db,
      tenantId,
      adminUid,
      "tenant_admin",
      input.isActive ? "user.activated" : "user.deactivated",
      input.userId,
      { isActive: input.isActive }
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[POST /api/staff/set-status]", err);
    }
    return NextResponse.json({ code: "internal", message: "স্ট্যাটাস পরিবর্তন করা যায়নি" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
