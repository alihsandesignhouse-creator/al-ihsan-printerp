import type { Config } from "@netlify/functions";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "../../lib/firebase/admin";

/**
 * netlify/functions/send-daily-notifications.mts
 *
 * Migrated from `functions/src/notificationFunctions.ts` →
 * `sendDailyNotifications` (Firebase Cloud Function,
 * `pubsub.schedule("0 9 * * *")`, `Asia/Dhaka`). Only the *scheduled*
 * digest function is migrated here — `notifyOnNewOrder` and
 * `notifyOnLowStock` are Firestore *triggers*, not scheduled functions,
 * and belong to the separate "Direct-Call Pattern" Migration Map item
 * (blueprint অংশ ১.২, event-driven rows), not this one.
 *
 * ── Business logic (UNCHANGED, hu-bohu same as the Cloud Function) ──────
 * For every tenant, for every branch: count today's non-delivered/
 * non-cancelled deliveries and overdue-with-due-amount orders, and write
 * one deduplicated notification document per branch per day for each
 * (docId `todaysDelivery_{branchId}_{dateKey}` / `dueAlert_{branchId}_
 * {dateKey}` — re-running the same day overwrites the same doc, exactly
 * as the original `.set()` with a deterministic docId did).
 *
 * ── Timezone trade-off (same reasoning as the other two migrations) ─────
 * Original schedule was "0 9 * * *" Asia/Dhaka (09:00 Dhaka, fixed UTC+6,
 * no DST) = 03:00 UTC on the *same* UTC calendar day. Cron below:
 * "0 3 * * *" — fires at exactly 09:00 Dhaka time every day.
 *
 * ── 30-second execution limit (Netlify Scheduled Functions constraint,
 *    the most relevant one of the three migrated functions) ────────────
 * This function is O(tenants × branches × 2 queries) — the most
 * expensive of the three migrated scheduled functions. The original
 * Cloud Function had no hard timeout in this configuration; Netlify
 * Scheduled Functions cap execution at 30 seconds. For Free Edition's
 * expected scale (testing/demo/early onboarding — a handful of tenants,
 * each with a handful of branches, per the blueprint's stated purpose)
 * this is not expected to be an issue. If tenant/branch count grows
 * large enough to risk the 30s ceiling, this would need to be split into
 * multiple scheduled functions (e.g. sharded by tenant ID range) or
 * moved to a Background Function — not done in this session, flagged
 * here as a known Free Edition constraint for a future session.
 */

type NotificationType = "new_order" | "todays_delivery" | "due_alert" | "low_stock";

interface NotificationInput {
  branchId: string;
  type: NotificationType;
  titleKey: string;
  params: Record<string, string | number>;
  link: string | null;
}

async function createNotification(
  db: Firestore,
  tenantId: string,
  input: NotificationInput,
  docId?: string
): Promise<void> {
  const colRef = db.collection("tenants").doc(tenantId).collection("notifications");
  const ref = docId ? colRef.doc(docId) : colRef.doc();
  await ref.set({
    id: ref.id,
    tenantId,
    branchId: input.branchId,
    type: input.type,
    titleKey: input.titleKey,
    params: input.params,
    link: input.link,
    readBy: [],
    createdAt: FieldValue.serverTimestamp(),
  });
}

export default async (req: Request) => {
  const { next_run } = (await req.json()) as { next_run?: string };
  if (process.env.NODE_ENV !== "production") {
    console.info("[send-daily-notifications] running, next run at:", next_run);
  }

  const db = getAdminDb();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const dateKey = todayStart.toISOString().slice(0, 10);

  const todayStartTs = Timestamp.fromDate(todayStart);
  const todayEndTs = Timestamp.fromDate(todayEnd);
  // AUDIT-REPORT-5.md Issue #7 fix (৫ আগস্ট ২০২৬): the overdue-orders
  // query below used to have no lower bound on expectedDeliveryDate — it
  // fetched every still-pending order ever overdue since the branch's
  // first day, growing heavier every day a tenant stays active
  // (independent of the tenant/branch-count scaling risk already
  // documented above). A 90-day window keeps the daily "due অ্যালার্ট"
  // notification meaningful (an order 90+ days overdue is already amply
  // flagged elsewhere — order list, reports, customer due totals — a
  // fresh daily nudge stops adding value at that point) while bounding
  // this query's cost. The order itself is untouched; only whether it's
  // counted in *today's digest notification* changes.
  const overdueWindowStart = new Date(todayStart);
  overdueWindowStart.setDate(overdueWindowStart.getDate() - 90);
  const overdueWindowStartTs = Timestamp.fromDate(overdueWindowStart);

  const tenantsSnap = await db.collection("tenants").get();
  let notificationsCreated = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const branchesSnap = await db.collection("tenants").doc(tenantId).collection("branches").get();
    if (branchesSnap.empty) continue;

    for (const branchDoc of branchesSnap.docs) {
      const branchId = branchDoc.id;
      const ordersRef = db.collection("tenants").doc(tenantId).collection("orders");

      // আজকের ডেলিভারি — একই কম্পোজিট ইনডেক্স (branchId, deletedAt,
      // expectedDeliveryDate) পুনরায় ব্যবহৃত, ঠিক আগের মতো।
      const todaysDeliverySnap = await ordersRef
        .where("branchId", "==", branchId)
        .where("deletedAt", "==", null)
        .where("expectedDeliveryDate", ">=", todayStartTs)
        .where("expectedDeliveryDate", "<=", todayEndTs)
        .get();

      const todaysDeliveryCount = todaysDeliverySnap.docs.filter((d) => {
        const status = d.data().status as string;
        return status !== "delivered" && status !== "cancelled";
      }).length;

      if (todaysDeliveryCount > 0) {
        await createNotification(
          db,
          tenantId,
          {
            branchId,
            type: "todays_delivery",
            titleKey: "notifications.messages.todaysDelivery",
            params: { count: todaysDeliveryCount },
            link: "/dashboard/pending-work",
          },
          `todaysDelivery_${branchId}_${dateKey}`
        );
        notificationsCreated += 1;
      }

      // বকেয়া সতর্কতা — মেয়াদ পেরিয়ে যাওয়া (আজকের আগে) অথচ এখনো ডেলিভারি
      // হয়নি এবং বকেয়া আছে এমন অর্ডার। একই ইনডেক্স, রেঞ্জ শুধু বিপরীত দিকে।
      // AUDIT-REPORT-5.md Issue #7 fix: এখন ৯০ দিনের একটা lower bound-ও
      // আছে — ফাইলটার নিজস্ব top-of-file কমেন্টে এই সিদ্ধান্তের কারণ
      // ব্যাখ্যা করা আছে।
      const overdueSnap = await ordersRef
        .where("branchId", "==", branchId)
        .where("deletedAt", "==", null)
        .where("expectedDeliveryDate", "<", todayStartTs)
        .where("expectedDeliveryDate", ">=", overdueWindowStartTs)
        .get();

      const dueAlertCount = overdueSnap.docs.filter((d) => {
        const data = d.data();
        const status = data.status as string;
        const dueAmount = (data.dueAmount as number) ?? 0;
        return status !== "delivered" && status !== "cancelled" && dueAmount > 0;
      }).length;

      if (dueAlertCount > 0) {
        await createNotification(
          db,
          tenantId,
          {
            branchId,
            type: "due_alert",
            titleKey: "notifications.messages.dueAlert",
            params: { count: dueAlertCount },
            link: "/dashboard/orders",
          },
          `dueAlert_${branchId}_${dateKey}`
        );
        notificationsCreated += 1;
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[send-daily-notifications] created ${notificationsCreated} notification(s) across ${tenantsSnap.size} tenant(s)`
    );
  }
};

export const config: Config = {
  schedule: "0 3 * * *",
};
