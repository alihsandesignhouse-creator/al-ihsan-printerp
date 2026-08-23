import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { syncTenantUserClaims } from "@/lib/server/tenant-claims-sync";

/**
 * POST /api/super-admin/activate-tenant
 *
 * Free Edition: replaces the Cloud Function `onTenantActivated`
 * (`functions/src/tenantFunctions.ts`) — a Firestore `onUpdate` trigger
 * on `tenants/{tenantId}` that reacted to `subscriptionStatus` changing
 * to `'active'`.
 *
 * Direct-Call Pattern (blueprint অংশ ১.২):
 *   `activateTenant()` in `lib/firebase/tenants.ts` calls this route
 *   immediately after a successful batch.commit() that sets
 *   `subscriptionStatus: 'active'` on the tenant document. The Firestore
 *   write (batch.commit) still happens client-side first; this route
 *   performs the privileged Admin SDK step (setCustomUserClaims) that the
 *   client cannot do for itself.
 *
 * Security model:
 *   Bearer ID-token verified server-side. Caller must have
 *   `role === 'super_admin'` in their verified custom claims — same guard
 *   as `app/api/super-admin/create-tenant/route.ts`.
 *   The tenantId is taken from the request body (the super admin is
 *   explicitly acting on a specific tenant — unlike tenant-scoped routes
 *   where tenantId comes from the caller's own claim).
 *
 * Business rules preserved from onTenantActivated:
 *   - Requires the tenant's subscriptionStatus == 'active' (reads from
 *     Firestore to verify, not trusted from client body)
 *   - Sets custom claims: { tenantId, role: 'tenant_admin', isActive: true,
 *     isTrial: false } for the tenant_admin, exactly matching the Cloud
 *     Function — PLUS (fix, audit item #1, ৩০ জুলাই ২০২৬, see
 *     lib/server/tenant-claims-sync.ts) cascades the same reactivation to
 *     every branch_manager/staff member under the tenant, restoring each
 *     one's claim to their own individual Firestore `isActive` value —
 *     the original Cloud Function never did this at all.
 *   - Writes a tenant.activated audit log entry under
 *     tenants/{tenantId}/audit_logs with the same fields
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  tenantId: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Verify super_admin identity ─────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { message: "Forbidden — super_admin only" },
      { status: 401 }
    );
  }
  const idToken = authHeader.slice(7);

  let callerUid: string;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.role !== "super_admin") {
      return NextResponse.json(
        { message: "Forbidden — super_admin only" },
        { status: 403 }
      );
    }
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json(
      { message: "Forbidden — super_admin only" },
      { status: 401 }
    );
  }

  // ── 2. Validate request body ───────────────────────────────────────────
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { tenantId } = body;

  // ── 3. Verify tenant is actually active (guard against stale client) ───
  const db = getAdminDb();
  const tenantRef = db.collection("tenants").doc(tenantId);
  let tenantData: FirebaseFirestore.DocumentData;
  try {
    const snap = await tenantRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Tenant not found" }, { status: 404 });
    }
    tenantData = snap.data() as FirebaseFirestore.DocumentData;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/super-admin/activate-tenant] fetch tenant", err);
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  if (tenantData.subscriptionStatus !== "active") {
    return NextResponse.json(
      { message: "Tenant subscription is not active — cannot set claims" },
      { status: 409 }
    );
  }

  // ── 4. Set custom claims (the privileged step the client cannot do) ────
  // SECURITY FIX (audit item #1, ৩০ জুলাই ২০২৬): this used to call
  // `auth.setCustomUserClaims(tenantId, ...)` directly, only ever touching
  // the tenant_admin's own claim. Reactivating a tenant must also restore
  // every branch_manager/staff member's claim (mirroring their own
  // individual Firestore `isActive` field, not resurrecting anyone who was
  // deliberately deactivated by their tenant_admin — see
  // lib/server/tenant-claims-sync.ts's header comment for the full rule).
  try {
    const auth = getAdminAuth();
    await syncTenantUserClaims(db, auth, tenantId, true, false);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/super-admin/activate-tenant] setCustomUserClaims", err);
    }
    return NextResponse.json(
      { message: "Custom claims update failed" },
      { status: 500 }
    );
  }

  // ── 5. Write audit log (same fields as Cloud Function) ─────────────────
  try {
    const now = Timestamp.now();
    const auditRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("audit_logs")
      .doc();

    await auditRef.set({
      id: auditRef.id,
      tenantId,
      userId: tenantData.activatedBy ?? callerUid,
      userEmail: "super_admin",
      action: "tenant.activated",
      resourceType: "tenant",
      resourceId: tenantId,
      changes: {
        subscriptionStatus: "active",
        planId: tenantData.planId ?? null,
      },
      ipAddress: req.headers.get("x-forwarded-for") ?? "",
      userAgent: "netlify-nextjs-api-route",
      createdAt: now,
    });
  } catch (err) {
    // Audit log failure is non-fatal — claims are already set
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/super-admin/activate-tenant] audit log write failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
