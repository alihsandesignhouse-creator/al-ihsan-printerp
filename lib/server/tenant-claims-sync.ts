import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

/**
 * lib/server/tenant-claims-sync.ts
 *
 * SECURITY FIX — audit item #1 (৩০ জুলাই ২০২৬): "Tenant suspend/trial-
 * expiry শুধু tenant doc + tenant_admin-এর claim আপডেট করে; staff
 * (branch_manager/commission_staff/regular_staff)-দের Auth claim কখনো
 * revoke হয় না।"
 *
 * Before this fix:
 *   - `netlify/functions/check-trial-expiry.mts` called
 *     `auth.setCustomUserClaims(doc.id, ...)` where `doc.id` is the
 *     *tenant* document ID — which happens to equal the tenant_admin's own
 *     Firebase Auth UID in this system's convention, so only the
 *     tenant_admin's claim was ever touched. Every branch_manager/
 *     commission_staff/regular_staff member under that tenant (separate
 *     Auth users, listed in /tenants/{tenantId}/users) kept their stale
 *     `isActive: true` claim forever.
 *   - The manual Super-Admin suspend/reactivate action
 *     (`setTenantSuspended` in lib/firebase/tenants.ts) was a *pure client
 *     Firestore write* with no Admin SDK step at all — it didn't update
 *     even the tenant_admin's claim.
 *
 * This helper is now the single place that cascades a tenant-level status
 * change to every Auth user under that tenant, called from: the
 * activate-tenant route, the new set-tenant-suspended route, and
 * check-trial-expiry.
 *
 * Business rule preserved on reactivation: a staff member who was
 * individually deactivated by their own tenant_admin (T-07,
 * `/api/staff/set-status`) must NOT be silently resurrected just because
 * the tenant itself comes back online — so on reactivate
 * (`tenantIsActive: true`) each staff member's claim mirrors their own
 * Firestore `isActive` field, not a blanket `true`. On suspend/expiry
 * (`tenantIsActive: false`), everyone is forced to `false` regardless of
 * their individual flag, since the whole tenant is down.
 *
 * Errors for any single Auth user (e.g. already deleted) are swallowed —
 * same best-effort behavior the original code already had via `catch {}`
 * — one missing/deleted account should never block the rest of the
 * tenant's users from being synced.
 *
 * NOTE — this is a defense-in-depth / correctness fix, not what actually
 * closes the underlying access-control gap: an already-open session's
 * Firebase ID token keeps its stale claims until it naturally refreshes
 * (up to ~1 hour), regardless of how quickly this function runs. The fix
 * that closes the gap *immediately* is firestore.rules' `isActiveUser()`
 * now cross-checking the live tenant document via `get()` — see that
 * function's comment. This claims sync still matters for: (a) new logins/
 * token refreshes reflecting the correct state promptly, and (b) any
 * Admin-SDK-verified API route that checks `decoded.role`/claims directly
 * instead of re-reading Firestore.
 */
export async function syncTenantUserClaims(
  db: Firestore,
  auth: Auth,
  tenantId: string,
  tenantIsActive: boolean,
  tenantIsTrial: boolean
): Promise<void> {
  const tenantAdminClaimUpdate = auth
    .setCustomUserClaims(tenantId, {
      tenantId,
      role: "tenant_admin",
      isActive: tenantIsActive,
      isTrial: tenantIsTrial,
    })
    .catch(() => {
      /* tenant_admin's Auth user may have been deleted — best-effort */
    });

  const usersSnap = await db.collection("tenants").doc(tenantId).collection("users").get();

  const staffClaimUpdates = usersSnap.docs
    .filter((docSnap) => !docSnap.data().deletedAt)
    .map((docSnap) => {
      const data = docSnap.data();
      const effectiveActive = tenantIsActive ? Boolean(data.isActive) : false;
      return auth
        .setCustomUserClaims(docSnap.id, {
          tenantId,
          role: data.role as string,
          isActive: effectiveActive,
          isTrial: false,
          branchId: (data.branchId as string | null) ?? null,
        })
        .catch(() => {
          /* this staff member's Auth user may have been deleted — best-effort */
        });
    });

  await Promise.all([tenantAdminClaimUpdate, ...staffClaimUpdates]);
}
