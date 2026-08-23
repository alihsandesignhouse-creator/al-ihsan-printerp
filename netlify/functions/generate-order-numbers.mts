import type { Config } from "@netlify/functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../../lib/firebase/admin";

/**
 * netlify/functions/generate-order-numbers.mts
 *
 * Migrated from `functions/src/orderFunctions.ts` → `generateOrderNumber`
 * (Firebase Cloud Function, `firebase-functions/v2/firestore`
 * `onDocumentCreated` trigger on `tenants/{tenantId}/orders/{orderId}`).
 * Migration Map reference: `PrintERP_Free_Edition_Blueprint.md`, অংশ ১.২,
 * সারি "generateOrderNumber" → Netlify Scheduled Function, **Polling
 * Pattern** — the row the blueprint itself flags as "সবচেয়ে জটিল অংশ"
 * (the most complex part) of the entire Migration Map, and the last
 * remaining row.
 *
 * ── Why polling instead of a trigger ─────────────────────────────────────
 * Firebase Spark plan cannot deploy Cloud Functions, so there is no
 * `onDocumentCreated` trigger available. Firestore itself has no built-in
 * "on write" webhook outside Cloud Functions, so a scheduled sweep is the
 * only Spark-compatible replacement: every run, find orders still carrying
 * their client-written temporary "OFFLINE-{timestamp}" `orderNumber` and
 * assign the real sequential number.
 *
 * ── Business logic (UNCHANGED, hu-bohu same as the Cloud Function) ──────
 * Per tenant, per calendar year, a counter document
 * (`tenants/{tenantId}/counters/order_{year}`) tracks `lastSequence`. Inside
 * a Firestore transaction: read the counter, increment it, write
 * `{orderIdPrefix}{year}-{seq padded to 4 digits}` (e.g. "PP-2026-0001") to
 * the order's `orderNumber` field. `orderIdPrefix` comes from the tenant
 * document, falling back to "PP-" if absent — the exact same fallback
 * string as the original Cloud Function (this preserves a pre-existing
 * quirk: `onTenantSelfSignup` stores `orderIdPrefix: 'PP'` without a
 * trailing dash, so self-signup tenants get "PP2026-0001" while the
 * fallback path yields "PP-2026-0001" — this inconsistency already existed
 * in the original Cloud Function and is out of scope to fix here, per the
 * "no business-rule changes" session rule).
 *
 * Only orders whose `orderNumber` still starts with "OFFLINE-" are
 * targeted — an order that already has a final sequential number is never
 * re-processed, exactly matching the original trigger's re-entrancy guard
 * (`if (!existingNumber || !existingNumber.startsWith("OFFLINE-")) return;`).
 * Because a Firestore transaction serializes the counter read-increment-
 * write, concurrent runs (see "Race condition" below) cannot assign the
 * same sequential number twice.
 *
 * ── Finding candidate orders across all tenants (new — polling-specific) ─
 * The original trigger fired per-document at creation time, so it never
 * needed a cross-tenant query. The scheduled sweep does, and orders live at
 * `tenants/{tenantId}/orders/{orderId}` — a collection group query is the
 * only way to find them all in one pass. Firestore's `>=` / `<` range
 * technique (`orderNumber >= "OFFLINE-"` AND `orderNumber < "OFFLINE-\uf8ff"`)
 * performs a prefix match by UTF-16 code-unit ordering (`\uf8ff` is a very
 * high, rarely-used code point that sorts after virtually all real
 * strings). Collection *group* range queries on a field require the field
 * to be explicitly enabled for COLLECTION_GROUP scope — added as a
 * `fieldOverrides` entry in `firestore.indexes.json` (append-only, no
 * existing lines touched) in this same session.
 *
 * ── Race condition safety (multiple concurrent function instances) ──────
 * If Netlify ever runs two instances of this scheduled function
 * overlapping (e.g. a slow previous run plus the next scheduled tick), both
 * could read the same "OFFLINE-" order in their initial query. This is
 * safe: each order's actual number assignment happens inside a per-order
 * Firestore transaction that (a) increments the per-tenant/per-year counter
 * document atomically and (b) re-reads the order document *inside* the
 * transaction to check `orderNumber` still starts with "OFFLINE-" before
 * writing — the second instance to reach the transaction for the same
 * order will see the already-updated (non-"OFFLINE-") value and skip it,
 * so no order can be assigned two different numbers and no sequence number
 * can be issued twice, exactly like the original Cloud Function's
 * safety was guaranteed by Firestore's transaction serialization.
 *
 * ── Notification integration (new decision this session) ────────────────
 * F1#5 (Direct-Call Pattern) already fires a `newOrder_{orderId}`
 * notification document at order-creation time via
 * `fireNewOrderNotification()` — but only when the client is online at
 * creation time (best-effort `fetch()` call, per F1#5 notes). Two gaps
 * remain that only this polling function can close, since it is the one
 * piece of code that reliably runs regardless of the client's connectivity
 * at creation time:
 *   1. An order created fully offline never got a chance to call
 *      `fetch()` at all (no `auth.currentUser`-driven client code runs
 *      here — this is a server-side Scheduled Function), so no
 *      notification document exists yet for it.
 *   2. An order created online *did* get notified immediately, but with
 *      the temporary "OFFLINE-{timestamp}" number in its `params`, since
 *      that was the only number known at that moment.
 * Both are resolved by writing the notification document directly via the
 * Admin SDK (not `fetch()` — there is no end-user Bearer token available
 * in a Scheduled Function's execution context) using the same deterministic
 * docId (`newOrder_{orderId}`) and the same full-overwrite `.set()`
 * semantics as `app/api/notifications/new-order/route.ts`, so:
 *   - Case 1 gets its first (and only) notification, now with the correct
 *     final order number.
 *   - Case 2's existing notification document is overwritten in place with
 *     the corrected `orderNumber` param — same notification, same docId,
 *     just accurate now. (This resets `readBy: []`, matching the existing
 *     idempotent-`.set()` convention already established by the API route
 *     itself — a deliberate consistency choice, not an oversight.)
 * This write happens only after the order-number transaction above commits
 * successfully, and is itself wrapped in its own try/catch so a
 * notification failure never rolls back or blocks the (already-committed)
 * order-number assignment.
 *
 * ── 30-second execution limit / batch size (Netlify constraint) ─────────
 * Capped at 200 candidate orders per run (`.limit(200)`) to stay well
 * within the 30-second ceiling even in a worst case. Any remainder is
 * picked up on the next run (every 3 minutes — see `config.schedule`
 * below), so a backlog only delays final numbering by a few extra minutes,
 * never drops an order.
 *
 * ── Cron granularity (Free Edition limitation — documented per this
 *    session's explicit instruction to verify against docs.netlify.com) ──
 * Netlify's public cron documentation (docs.netlify.com/build/functions/
 * scheduled-functions and the cron-expression-format reference page) does
 * not state an explicit minimum interval — standard 5-field cron syntax is
 * accepted and minute-level fields are honored. Community reports (Netlify
 * support forum threads, third-party cron-relay vendors) suggest very
 * frequent schedules — particularly true 1-minute cadence — may be subject
 * to plan-tier throttling in practice, though this is not confirmed in the
 * official docs. An "every 3 minutes" cron expression (minute-field step
 * value of 3 — written out in prose here rather than as a literal string,
 * to avoid a stray star-slash sequence prematurely closing this comment
 * block) is used below, per the blueprint's stated 3-minute polling
 * interval; see `config.schedule` at the bottom of this file for the
 * literal cron string (UTC — Netlify Scheduled Functions always run in
 * UTC, no `.timeZone()` equivalent). If Netlify's dashboard reports this
 * schedule is throttled or coalesced on the account's plan tier after
 * deployment, the documented fallback is the equivalent "every 5 minutes"
 * expression — a purely operational change (one cron-string edit), not a
 * code change, and does not affect correctness, only how quickly
 * offline-created orders receive their final number.
 */

const BATCH_LIMIT = 200;

export default async (req: Request) => {
  const { next_run } = (await req.json()) as { next_run?: string };
  if (process.env.NODE_ENV !== "production") {
    console.info("[generate-order-numbers] running, next run at:", next_run);
  }

  const db = getAdminDb();

  const candidates = await db
    .collectionGroup("orders")
    .where("orderNumber", ">=", "OFFLINE-")
    .where("orderNumber", "<", "OFFLINE-\uf8ff")
    .limit(BATCH_LIMIT)
    .get();

  if (candidates.empty) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[generate-order-numbers] no pending OFFLINE- order(s)");
    }
    return;
  }

  // Cache tenant orderIdPrefix lookups within this run to avoid re-reading
  // the same tenant document once per order (a tenant can have many
  // pending orders in a single sweep).
  const prefixCache = new Map<string, string>();

  let assigned = 0;
  let failed = 0;

  for (const orderDoc of candidates.docs) {
    // orders live at tenants/{tenantId}/orders/{orderId}; the tenant
    // document is the parent-of-the-parent collection reference.
    const tenantRef = orderDoc.ref.parent.parent;
    if (!tenantRef) continue; // defensive — should never happen for this path
    const tenantId = tenantRef.id;
    const orderId = orderDoc.id;

    try {
      let orderIdPrefix = prefixCache.get(tenantId);
      if (orderIdPrefix === undefined) {
        const tenantSnap = await tenantRef.get();
        orderIdPrefix = (tenantSnap.data()?.orderIdPrefix as string) || "PP-";
        prefixCache.set(tenantId, orderIdPrefix);
      }

      const year = new Date().getFullYear();
      const counterRef = tenantRef.collection("counters").doc(`order_${year}`);
      const orderRef = tenantRef.collection("orders").doc(orderId);

      const finalNumber = await db.runTransaction(async (tx) => {
        // Re-check inside the transaction — guards against a second
        // concurrent function instance already having assigned a number
        // to this same order between the initial query and this point.
        const freshOrderSnap = await tx.get(orderRef);
        const freshNumber = freshOrderSnap.data()?.orderNumber as string | undefined;
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
        const number = `${orderIdPrefix}${year}-${padded}`;
        tx.update(orderRef, { orderNumber: number, updatedAt: FieldValue.serverTimestamp() });
        return number;
      });

      if (!finalNumber) continue; // skipped — already handled concurrently

      assigned += 1;

      // Best-effort notification (Admin SDK direct write — see module
      // docblock "Notification integration" above). Never blocks or
      // rolls back the already-committed order-number assignment.
      try {
        const orderData = orderDoc.data();
        const notifRef = tenantRef.collection("notifications").doc(`newOrder_${orderId}`);
        await notifRef.set({
          id: `newOrder_${orderId}`,
          tenantId,
          branchId: (orderData.branchId as string) ?? "",
          type: "new_order",
          titleKey: "notifications.messages.newOrder",
          params: {
            orderNumber: finalNumber,
            customerName: (orderData.customerName as string) ?? "",
          },
          link: `/dashboard/orders/${orderId}`,
          readBy: [] as string[],
          createdAt: Timestamp.now(),
        });
      } catch (notifError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[generate-order-numbers] notification write failed for order ${orderId} (tenant ${tenantId}):`,
            notifError
          );
        }
      }
    } catch (error) {
      failed += 1;
      console.error(
        `[generate-order-numbers] failed to assign sequential order number for order ${orderId} (tenant ${tenantId}):`,
        error
      );
      // Leave the OFFLINE-{timestamp} number in place on failure — the
      // order remains valid and usable, and will be retried on the next
      // scheduled run (same recovery behavior as the original Cloud
      // Function, which simply logged and left the temporary number).
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[generate-order-numbers] assigned ${assigned} order number(s), ${failed} failure(s), ${candidates.size} candidate(s) this run`
    );
  }
};

export const config: Config = {
  schedule: "*/3 * * * *",
};
