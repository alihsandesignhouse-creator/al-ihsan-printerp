import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { syncTenantUserClaims } from "@/lib/server/tenant-claims-sync";

/**
 * POST /api/super-admin/sync-tenant-claims
 *
 * SECURITY FIX — audit item #1 (৩০ জুলাই ২০২৬): `setTenantSuspended()` in
 * lib/firebase/tenants.ts (the Super Admin "স্থগিত/সক্রিয়" toggle on the
 * tenant detail page) was previously a *pure client Firestore write* —
 * `updateDoc(tenantDoc(tenantId), { subscriptionStatus, isActive, ... })`
 * — with no Admin SDK step at all, so no Auth custom claim was ever
 * touched: not the tenant_admin's, and not any branch_manager/staff
 * member's. Same "Direct-Call Pattern" as app/api/super-admin/
 * activate-tenant/route.ts: the client still writes the Firestore
 * document itself first (super_admin's blanket firestore.rules access
 * already covers that write), then calls this route as a best-effort
 * side-call for the privileged claims cascade the client cannot perform
 * on its own.
 *
 * See lib/server/tenant-claims-sync.ts for the exact cascade rule (staff
 * individually deactivated by their own tenant_admin stay deactivated on
 * tenant reactivation).
 *
 * Also called (indirectly, same underlying helper) from
 * check-trial-expiry.mts's scheduled expiry path — this route itself is
 * only reached via the manual Super-Admin suspend/reactivate UI action.
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  tenantId: z.string().min(1),
  isActive: z.boolean(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Verify super_admin identity ─────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  let callerUid: string;
  const auth = getAdminAuth();
  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 403 });
    }
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 401 });
  }

  // ── 2. Validate request body ────────────────────────────────────────────
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const { tenantId, isActive } = body;

  // ── 3. Read the tenant doc — guard against a stale/racing client, and
  //      source the isTrial flag the claims cascade needs to preserve ────
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
      console.error("[api/super-admin/sync-tenant-claims] fetch tenant", err);
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  if (Boolean(tenantData.isActive) !== isActive) {
    return NextResponse.json(
      { message: "Tenant document's isActive doesn't match the request yet — write it first" },
      { status: 409 }
    );
  }

  // ── 4. Cascade the claim to tenant_admin + every staff member ──────────
  try {
    await syncTenantUserClaims(db, auth, tenantId, isActive, Boolean(tenantData.isTrial));
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/super-admin/sync-tenant-claims] setCustomUserClaims", err);
    }
    return NextResponse.json({ message: "Custom claims update failed" }, { status: 500 });
  }

  // ── 5. Audit log (best-effort, non-fatal) ───────────────────────────────
  try {
    const now = Timestamp.now();
    const auditRef = tenantRef.collection("audit_logs").doc();
    await auditRef.set({
      id: auditRef.id,
      tenantId,
      userId: callerUid,
      userEmail: "super_admin",
      action: isActive ? "tenant.reactivated" : "tenant.suspended",
      resourceType: "tenant",
      resourceId: tenantId,
      changes: { isActive },
      ipAddress: req.headers.get("x-forwarded-for") ?? "",
      userAgent: "netlify-nextjs-api-route",
      createdAt: now,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/super-admin/sync-tenant-claims] audit log write failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
