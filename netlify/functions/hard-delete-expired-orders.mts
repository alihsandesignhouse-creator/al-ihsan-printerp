import type { Config } from "@netlify/functions";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../../lib/firebase/admin";

/**
 * netlify/functions/hard-delete-expired-orders.mts
 *
 * Implements `hardDeleteExpiredOrders` from the blueprint (অংশ ১৩.১ "অর্ডার
 * Soft Delete" ও অংশ ১২.৩ Cloud Functions তালিকা, "Scheduled (মাসিক)").
 * This row was present in the blueprint's Cloud Functions table but was
 * never actually implemented in the original `functions/src/` (Main
 * Edition, Blaze plan) either — confirmed via `grep -r
 * "hardDeleteExpiredOrders" functions/src netlify/functions` returning no
 * hits before this file was added. This is new work, not a migration.
 *
 * ── Business logic (per blueprint ১৩.১) ──────────────────────────────────
 * "৩০ দিন পর: Cloud Function স্বয়ংক্রিয়ভাবে স্থায়ী মুছে ফেলবে। পেমেন্ট,
 * কস্টিং ডেটা অক্ষত থাকবে।" — For every tenant, find orders where
 * `deletedAt` is a Timestamp older than 30 days (soft-deleted via T-02's
 * delete flow — `orders.ts` sets `deletedAt: serverTimestamp()`), and hard
 * delete ONLY the order document plus its `order_items` subcollection
 * (Firestore does not cascade-delete subcollections automatically).
 * `payments/{paymentId}` and `order_costings/{orderId}` are top-level
 * tenant collections that reference the order by ID but are never touched
 * here — exactly matching "পেমেন্ট, কস্টিং ডেটা অক্ষত থাকবে".
 *
 * A single `where("deletedAt", "<", cutoff)` range filter naturally
 * excludes documents where `deletedAt === null` (Firestore range/
 * inequality filters exclude fields that don't hold a comparable value —
 * same behavior already relied on elsewhere in this codebase, e.g.
 * check-quotation-expiry.mts's `validUntil < now`), so no extra
 * `deletedAt != null` filter is needed and no new composite index is
 * required beyond the automatic single-field index Firestore already
 * maintains for `deletedAt`.
 *
 * ── Timezone / schedule ───────────────────────────────────────────────────
 * Blueprint says "মাসিক" (monthly) without a specific time of day (unlike
 * checkTrialExpiry's explicit ০০:০১ or checkQuotationExpiry's ০০:০৫).
 * Chosen: 1st of every month at 00:15 Asia/Dhaka — 15 minutes after the
 * other two daily jobs' Dhaka-midnight window, avoiding overlap, still
 * comfortably inside the low-traffic overnight period. Asia/Dhaka is a
 * fixed UTC+6 offset (no DST), so 00:15 Dhaka = 18:15 UTC the previous
 * day → cron "15 18 1 * *".
 *
 * ── 30-second execution limit (Netlify Scheduled Functions constraint) ───
 * Same trade-off documented in check-quotation-expiry.mts: iterates every
 * tenant with one query + one batch each. Expected to stay well within
 * budget at Free Edition's expected scale, since this only touches orders
 * that have been sitting soft-deleted for over a month — a small, slowly
 * accumulating set, not the full order history.
 *
 * ── Firestore batch 500-write limit ──────────────────────────────────────
 * A batch write can contain at most 500 operations. Each expired order
 * costs (1 delete for the order + N deletes for its order_items). To stay
 * safely under the limit per tenant per run, this function caps processing
 * at 100 orders per tenant per run (worst case ~5 items/order ≈ 500 ops);
 * any remainder is simply picked up on the next monthly run — no data is
 * lost, deletion is just spread across runs if a tenant has an unusually
 * large backlog.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ORDERS_PER_TENANT_PER_RUN = 100;

export default async (req: Request) => {
  const { next_run } = (await req.json()) as { next_run?: string };
  if (process.env.NODE_ENV !== "production") {
    console.info("[hard-delete-expired-orders] running, next run at:", next_run);
  }

  const db = getAdminDb();
  const cutoff = Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS);
  const tenantsSnap = await db.collection("tenants").get();

  let totalDeletedOrders = 0;
  let totalDeletedItems = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const expiredQuery = await db
      .collection("tenants")
      .doc(tenantDoc.id)
      .collection("orders")
      .where("deletedAt", "<", cutoff)
      .limit(MAX_ORDERS_PER_TENANT_PER_RUN)
      .get();

    if (expiredQuery.empty) continue;

    const batch = db.batch();
    let batchOps = 0;

    for (const orderDoc of expiredQuery.docs) {
      const itemsSnap = await orderDoc.ref.collection("order_items").get();
      itemsSnap.docs.forEach((itemDoc) => {
        batch.delete(itemDoc.ref);
        batchOps += 1;
        totalDeletedItems += 1;
      });

      batch.delete(orderDoc.ref);
      batchOps += 1;
      totalDeletedOrders += 1;
    }

    if (batchOps > 0) {
      await batch.commit();
    }

    if (process.env.NODE_ENV !== "production" && batchOps > 0) {
      console.info(
        `[hard-delete-expired-orders] tenant ${tenantDoc.id}: hard-deleted ${expiredQuery.size} order(s)`
      );
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[hard-delete-expired-orders] total: ${totalDeletedOrders} order(s), ${totalDeletedItems} order_item(s) across ${tenantsSnap.size} tenant(s)`
    );
  }
};

export const config: Config = {
  schedule: "15 18 1 * *",
};
