import type { Config } from "@netlify/functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../../lib/firebase/admin";

/**
 * netlify/functions/check-quotation-expiry.mts
 *
 * Migrated from `functions/src/quotationFunctions.ts` →
 * `checkQuotationExpiry` (Firebase Cloud Function,
 * `pubsub.schedule("5 0 * * *")`, `Asia/Dhaka`).
 * Migration Map reference: `PrintERP_Free_Edition_Blueprint.md`, অংশ ১.২,
 * সারি "checkQuotationExpiry" → Netlify Scheduled Function.
 *
 * ── Business logic (PLUS a fix, ৫ আগস্ট ২০২৬) ──────────────────────────
 * For every tenant, find quotations where deletedAt === null AND
 * validUntil < now AND status in ["draft", "sent"], and set their status
 * to "expired" (updatedAt: serverTimestamp()).
 *
 * RACE-CONDITION FIX (AUDIT-REPORT-5.md Issue #6, ৫ আগস্ট ২০২৬): the
 * original Cloud Function (and this function, until this fix) collected
 * the whole tenant's expiring-quotation query snapshot and wrote all of
 * them via a single `db.batch()` with an unconditional `status:
 * "expired"` — no re-check between the query snapshot and the commit. If
 * a customer/staff accepted or rejected one of those exact quotations in
 * that window (a client write straight to Firestore, completely separate
 * from this function), the batch commit would silently clobber their
 * decision back to "expired". Now each quotation is updated inside its
 * own `db.runTransaction()`, which re-reads the document immediately
 * before writing and only proceeds if `status` is *still* "draft"/"sent"
 * — if the customer already acted, this function now correctly skips
 * that quotation instead of overwriting it. This is a genuine behavior
 * change from "হু-বহু same as the Cloud Function" for this one specific
 * bug — documented here and in MODULE_README.md, same pattern as the
 * check-trial-expiry.mts claims-cascade fix.
 *
 * ── Timezone trade-off (same reasoning as check-trial-expiry.mts) ───────
 * Original schedule was "5 0 * * *" Asia/Dhaka (00:05 Dhaka, fixed UTC+6,
 * no DST) = 18:05 UTC on the previous UTC calendar day. Cron below:
 * "5 18 * * *" — fires at exactly 00:05 Dhaka time every day.
 *
 * ── 30-second execution limit (Netlify Scheduled Functions constraint) ──
 * This function iterates every tenant document and runs one query per
 * tenant, plus (as of the Issue #6 fix) one transaction per *expiring*
 * quotation within that tenant (was: one batch commit per tenant).
 * Individually-transacted quotations are more RPCs than a single batch,
 * but the count is bounded by how many quotations are actually expiring
 * in this run (typically small), not total quotation history — same
 * cost shape as check-trial-expiry.mts's per-tenant claims cascade.
 * Unlike the Cloud Function (no hard timeout in this configuration),
 * Netlify Scheduled Functions cap execution at 30 seconds. With a small
 * number of tenants (Free Edition's expected scale — testing/demo/early
 * onboarding, per the blueprint's stated purpose) this is not expected
 * to be an issue; documented here as a known Free Edition constraint
 * that would need revisiting (e.g. batching tenants across multiple
 * scheduled runs) if tenant count grows large.
 */

export default async (req: Request) => {
  const { next_run } = (await req.json()) as { next_run?: string };
  if (process.env.NODE_ENV !== "production") {
    console.info("[check-quotation-expiry] running, next run at:", next_run);
  }

  const db = getAdminDb();
  const now = Timestamp.now();
  const tenantsSnap = await db.collection("tenants").get();

  let totalExpired = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const expiredQuery = await db
      .collection("tenants")
      .doc(tenantDoc.id)
      .collection("quotations")
      .where("deletedAt", "==", null)
      .where("validUntil", "<", now)
      .where("status", "in", ["draft", "sent"])
      .get();

    if (expiredQuery.empty) continue;

    // AUDIT-REPORT-5.md Issue #6 fix: per-quotation transaction with a
    // fresh re-read + status re-check, instead of an unconditional batch
    // write — see the top-of-file comment for the race this closes. Each
    // quotation is handled independently (like
    // lib/server/tenant-claims-sync.ts's per-user best-effort pattern) so
    // one already-actioned quotation being skipped doesn't block the
    // rest of the tenant's genuinely-expired quotations from processing.
    const results = await Promise.allSettled(
      expiredQuery.docs.map((quotationDoc) =>
        db.runTransaction(async (tx) => {
          const freshSnap = await tx.get(quotationDoc.ref);
          const freshData = freshSnap.data();
          if (!freshSnap.exists || !freshData) return false;
          if (freshData.status !== "draft" && freshData.status !== "sent") {
            // Customer/staff already accepted/rejected (or it was
            // otherwise changed) since the query snapshot — don't
            // overwrite their decision.
            return false;
          }
          tx.update(quotationDoc.ref, {
            status: "expired",
            updatedAt: FieldValue.serverTimestamp(),
          });
          return true;
        })
      )
    );
    const expiredCount = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    totalExpired += expiredCount;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[check-quotation-expiry] expired ${totalExpired} quotation(s) across ${tenantsSnap.size} tenant(s)`
    );
  }
};

export const config: Config = {
  schedule: "5 18 * * *",
};
