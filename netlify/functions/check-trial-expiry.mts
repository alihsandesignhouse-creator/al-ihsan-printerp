import type { Config } from "@netlify/functions";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../../lib/firebase/admin";
import { syncTenantUserClaims } from "../../lib/server/tenant-claims-sync";

/**
 * netlify/functions/check-trial-expiry.mts
 *
 * Migrated from `functions/src/tenantFunctions.ts` → `checkTrialExpiry`
 * (Firebase Cloud Function, `pubsub.schedule("1 0 * * *")`, `Asia/Dhaka`).
 * Migration Map reference: `PrintERP_Free_Edition_Blueprint.md`, অংশ ১.২,
 * সারি "checkTrialExpiry" → Netlify Scheduled Function.
 *
 * ── Business logic (হু-বহু same as the Cloud Function, PLUS a fix) ──────
 * Find tenants where subscriptionStatus === "trial" AND isActive === true
 * AND trialEndsAt < now; for each one: mark subscriptionStatus "expired" +
 * isActive false, write a `tenant.trial_expired` audit log entry, then
 * revoke every user's active custom claim under that tenant — the
 * tenant_admin AND every branch_manager/staff member (best-effort — a
 * deleted Auth user is silently ignored, exactly like the original
 * `catch {}`). The batch commit happens once, after the loop, exactly as
 * before.
 *
 * SECURITY FIX (audit item #1, ৩০ জুলাই ২০২৬): the original Cloud
 * Function (and this function, until this fix) only ever called
 * `auth.setCustomUserClaims(doc.id, ...)` — `doc.id` is the *tenant*
 * document ID, which equals the tenant_admin's own Auth UID by this
 * system's convention, so ONLY the tenant_admin's claim was ever revoked.
 * Every branch_manager/commission_staff/regular_staff member under an
 * expired-trial tenant kept a stale `isActive: true` claim forever. Now
 * uses the shared `syncTenantUserClaims` helper (see
 * lib/server/tenant-claims-sync.ts) to cascade to every user. This is a
 * genuine behavior change from "হু-বহু same as the Cloud Function" for
 * this one specific bug — documented here and in MODULE_README.md.
 *
 * ── Timezone trade-off (Free Edition limitation — documented) ───────────
 * Netlify Scheduled Functions cron expressions always run in UTC and have
 * no `.timeZone()` equivalent (unlike Firebase Cloud Scheduler, which ran
 * this at "1 0 * * *" Asia/Dhaka = 00:01 Dhaka time). Asia/Dhaka is a
 * fixed UTC+6 offset (no DST), so 00:01 Dhaka = 18:01 UTC on the
 * *previous* UTC calendar day. The cron expression below ("1 18 * * *")
 * is chosen so the function still fires at exactly 00:01 Dhaka time every
 * day — only the cron string itself now reads as "previous UTC day" from
 * a UTC-centric view. No behavior change for end users.
 *
 * ── 30-second execution limit (Netlify Scheduled Functions constraint) ──
 * Unlike the Cloud Function (no hard timeout for scheduled pubsub
 * functions in this configuration), Netlify Scheduled Functions have a
 * hard 30 second execution limit. This function's cost scales with the
 * number of *expiring* trial tenants in a single run (typically small —
 * trials expire gradually, not all at once), not the total tenant count,
 * so this is not expected to be an issue in practice. Documented here as
 * a known Free Edition constraint per the session's discovery-tracking
 * convention.
 */

export default async (req: Request) => {
  const { next_run } = (await req.json()) as { next_run?: string };
  if (process.env.NODE_ENV !== "production") {
    console.info("[check-trial-expiry] running, next run at:", next_run);
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const now = Timestamp.now();
  // AUDIT-REPORT-5.md Issue #5 fix support: scopes the deterministic
  // audit-log ID to "this calendar day" rather than "forever", so a
  // legitimately new trial-expiry event for the same tenant on a later
  // day (e.g. after Super Admin resets/re-grants a trial) still gets its
  // own audit entry — only same-day concurrent-invocation duplicates are
  // deduplicated.
  const dateKey = now.toDate().toISOString().slice(0, 10);

  const snapshot = await db
    .collection("tenants")
    .where("subscriptionStatus", "==", "trial")
    .where("isActive", "==", true)
    .where("trialEndsAt", "<", now)
    .get();

  if (snapshot.empty) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[check-trial-expiry] no expired trial tenant(s)");
    }
    return;
  }

  const batch = db.batch();

  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      subscriptionStatus: "expired",
      isActive: false,
      updatedAt: now,
    });

    // Audit log — same shape as the original Cloud Function entry.
    // AUDIT-REPORT-5.md Issue #5 fix (৫ আগস্ট ২০২৬): ref used to be an
    // auto-generated ID (doc.ref.collection("audit_logs").doc() with no
    // argument) — if this function's invocations ever overlapped
    // (concurrent trigger), the same tenant's trial-expiry could produce
    // two separate audit_logs entries. Now deterministic per tenant
    // (a tenant only ever expires its trial once, so tenantId alone is a
    // safe key), matching the idempotency convention already used by
    // send-daily-notifications.mts and retry-notification-deliveries.mts.
    // Re-running for the same tenant now overwrites the same log entry
    // instead of duplicating it.
    const auditRef = doc.ref.collection("audit_logs").doc(`trial_expired_${doc.id}_${dateKey}`);
    batch.set(auditRef, {
      id: auditRef.id,
      tenantId: doc.id,
      userId: "system",
      userEmail: "system",
      action: "tenant.trial_expired",
      resourceType: "tenant",
      resourceId: doc.id,
      changes: { subscriptionStatus: "expired", isActive: false },
      ipAddress: "",
      // Original value was "cloud-scheduler" — updated to accurately
      // reflect the new infrastructure source. Metadata only, not a
      // business rule, so this does not change behavior.
      userAgent: "netlify-scheduled-function",
      createdAt: now,
    });

    // Custom claims cascade happens inside the loop, before the batch
    // commit below — same ordering as the original Cloud Function, but
    // now covers every user under the tenant, not just the tenant_admin
    // (audit fix #1 — see lib/server/tenant-claims-sync.ts).
    await syncTenantUserClaims(db, auth, doc.id, false, true);
  }

  await batch.commit();

  if (process.env.NODE_ENV !== "production") {
    console.info(`[check-trial-expiry] expired ${snapshot.size} trial tenant(s)`);
  }
};

export const config: Config = {
  schedule: "1 18 * * *",
};
