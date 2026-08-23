import type { Config } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../lib/firebase/admin";

/**
 * netlify/functions/generate-quotation-numbers.mts
 *
 * Migrated from `functions/src/quotationFunctions.ts` →
 * `generateQuotationNumber` (Firebase Cloud Function,
 * `firebase-functions/v2/firestore` `onDocumentCreated` trigger on
 * `tenants/{tenantId}/quotations/{quotationId}`). Migration Map reference:
 * `PrintERP_Free_Edition_Blueprint.md`, অংশ ১.২, সারি
 * "generateQuotationNumber" → Netlify Scheduled Function, Polling Pattern —
 * this is the **last remaining row** of the entire Function Migration Map.
 * Structurally this is the same Polling Pattern implemented for
 * `generate-order-numbers.mts` in this same session — see that file's
 * docblock for the full rationale (why polling instead of a trigger,
 * collection-group prefix-range query technique, race-condition safety via
 * per-document transactions, 30-second execution limit / batch cap, and
 * the cron-granularity trade-off). Only the quotation-specific differences
 * are called out below to avoid duplicating that explanation.
 *
 * ── Business logic (UNCHANGED, hu-bohu same as the Cloud Function) ──────
 * Per tenant, per calendar year, a *separate* counter document
 * (`tenants/{tenantId}/counters/quotation_{year}` — distinct from the order
 * counter so order and quotation numbering sequences never collide or
 * share state) tracks `lastSequence`. Format is always `QT-{year}-{seq
 * padded to 4 digits}` (e.g. "QT-2026-0001") — unlike orders, there is no
 * tenant-configurable prefix for quotations in the original Cloud Function,
 * so none is read here either.
 *
 * ── No notification integration (deliberate difference from orders) ─────
 * `functions/src/notificationFunctions.ts` only ever defined
 * `notifyOnNewOrder` and `notifyOnLowStock` — there was never a
 * `notifyOnNewQuotation` Cloud Function trigger in the original codebase,
 * so nothing analogous needs to be replicated here. This function's only
 * job is the number assignment itself.
 *
 * ── Collection-group index ───────────────────────────────────────────────
 * Uses the `quotations`/`quotationNumber` COLLECTION_GROUP `fieldOverrides`
 * entry appended to `firestore.indexes.json` in this same session
 * (alongside the `orders`/`orderNumber` entry needed by the sibling
 * function).
 */

const BATCH_LIMIT = 200;

export default async (req: Request) => {
  const { next_run } = (await req.json()) as { next_run?: string };
  if (process.env.NODE_ENV !== "production") {
    console.info("[generate-quotation-numbers] running, next run at:", next_run);
  }

  const db = getAdminDb();

  const candidates = await db
    .collectionGroup("quotations")
    .where("quotationNumber", ">=", "OFFLINE-")
    .where("quotationNumber", "<", "OFFLINE-\uf8ff")
    .limit(BATCH_LIMIT)
    .get();

  if (candidates.empty) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[generate-quotation-numbers] no pending OFFLINE- quotation(s)");
    }
    return;
  }

  let assigned = 0;
  let failed = 0;

  for (const quotationDoc of candidates.docs) {
    // quotations live at tenants/{tenantId}/quotations/{quotationId}; the
    // tenant document is the parent-of-the-parent collection reference.
    const tenantRef = quotationDoc.ref.parent.parent;
    if (!tenantRef) continue; // defensive — should never happen for this path
    const tenantId = tenantRef.id;
    const quotationId = quotationDoc.id;

    try {
      const year = new Date().getFullYear();
      const counterRef = tenantRef.collection("counters").doc(`quotation_${year}`);
      const quotationRef = tenantRef.collection("quotations").doc(quotationId);

      const finalNumber = await db.runTransaction(async (tx) => {
        // Re-check inside the transaction — guards against a second
        // concurrent function instance already having assigned a number
        // to this same quotation between the initial query and this point.
        const freshSnap = await tx.get(quotationRef);
        const freshNumber = freshSnap.data()?.quotationNumber as string | undefined;
        if (!freshNumber || !freshNumber.startsWith("OFFLINE-")) {
          return null; // already assigned by a concurrent run — skip
        }

        const counterSnap = await tx.get(counterRef);
        const nextSeq = ((counterSnap.data()?.lastSequence as number) || 0) + 1;
        tx.set(
          counterRef,
          { lastSequence: nextSeq, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );

        const padded = String(nextSeq).padStart(4, "0");
        const number = `QT-${year}-${padded}`;
        tx.update(quotationRef, {
          quotationNumber: number,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return number;
      });

      if (!finalNumber) continue; // skipped — already handled concurrently
      assigned += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[generate-quotation-numbers] failed to assign sequential quotation number for quotation ${quotationId} (tenant ${tenantId}):`,
        error
      );
      // Leave the OFFLINE-{timestamp} number in place on failure — the
      // quotation remains valid and usable, and will be retried on the
      // next scheduled run.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[generate-quotation-numbers] assigned ${assigned} quotation number(s), ${failed} failure(s), ${candidates.size} candidate(s) this run`
    );
  }
};

export const config: Config = {
  schedule: "*/3 * * * *",
};
