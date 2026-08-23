import * as functionsV2 from "firebase-functions/v2/firestore";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * নোটিফিকেশন ডকুমেন্ট কাঠামো — blueprint ১২.১-এ `/tenants/{tenantId}/notifications/{notificationId}`
 * পাথ উল্লেখ আছে কিন্তু ফিল্ড বিস্তারিত নেই। এই সেশনের সিদ্ধান্ত:
 * - কোনো ইউজার-নির্দিষ্ট ডুপ্লিকেট ডকুমেন্ট নেই। একটি ইভেন্ট = একটি ডকুমেন্ট,
 *   `branchId` (সবসময় real শাখা — orders/stock_items/branches-এ branchId
 *   বাধ্যতামূলক ফিল্ড, tenant-wide কেস এই সিস্টেমে ঘটে না) + read state
 *   (`readBy: uid[]`) দিয়ে দৃশ্যমানতা ও পড়া/অপঠিত নিয়ন্ত্রিত হয় — চলমান
 *   কাজের তালিকার মতো একটি শেয়ারড workspace ধারণা।
 * - `titleKey`/`params` সংরক্ষিত হয় (নির্দিষ্ট ভাষায় প্রি-রেন্ডার করা টেক্সট নয়) —
 *   next-intl দিয়ে ক্লায়েন্টে বাংলা/ইংরেজি উভয় ভাষায় সঠিকভাবে রেন্ডার হয়।
 * - লক্ষ্য দর্শক: শুধু TENANT_ADMIN ও BRANCH_MANAGER (ব্যবসা-ব্যবস্থাপনা সতর্কতা,
 *   স্টাফ-facing নয়) — sidebar.tsx-এর অন্য admin-oriented আইটেমগুলোর কনভেনশন
 *   অনুসরণ করে।
 */
type NotificationType = "new_order" | "todays_delivery" | "due_alert" | "low_stock";

interface NotificationInput {
  branchId: string;
  type: NotificationType;
  titleKey: string;
  params: Record<string, string | number>;
  link: string | null;
}

async function createNotification(tenantId: string, input: NotificationInput, docId?: string): Promise<void> {
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
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── ১. নতুন অর্ডার (Admin) — event-driven ─────────────────────────────────

export const notifyOnNewOrder = functionsV2.onDocumentCreated(
  {
    document: "tenants/{tenantId}/orders/{orderId}",
    region: "asia-south1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const order = snapshot.data();
    const { tenantId, orderId } = event.params as { tenantId: string; orderId: string };

    try {
      await createNotification(tenantId, {
        branchId: order.branchId as string,
        type: "new_order",
        titleKey: "notifications.messages.newOrder",
        params: {
          orderNumber: (order.orderNumber as string) ?? "",
          customerName: (order.customerName as string) ?? "",
        },
        link: `/dashboard/orders/${orderId}`,
      });
    } catch (error) {
      logger.error("notifyOnNewOrder: failed to create notification", { tenantId, orderId, error });
    }
  }
);

// ─── ২. স্টক কম সতর্কতা — event-driven (নিচের দিকে থ্রেশহোল্ড অতিক্রম করলেই, বারবার নয়) ──

export const notifyOnLowStock = functionsV2.onDocumentUpdated(
  {
    document: "tenants/{tenantId}/stock_items/{stockId}",
    region: "asia-south1",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const minimumLevel = (after.minimumLevel as number) ?? 0;
    const wasAboveOrEqual = (before.currentStock as number) >= minimumLevel;
    const isNowBelow = (after.currentStock as number) < minimumLevel;

    // শুধু "উপরে/সমান" থেকে "নিচে" ক্রসিং-এ একবার নোটিফাই করা হয় — স্টক নিচে
    // থাকা অবস্থায় প্রতিটি ছোট লেনদেনে বারবার নোটিফিকেশন এড়াতে।
    if (!wasAboveOrEqual || !isNowBelow) return;

    const { tenantId, stockId } = event.params as { tenantId: string; stockId: string };

    try {
      await createNotification(tenantId, {
        branchId: after.branchId as string,
        type: "low_stock",
        titleKey: "notifications.messages.lowStock",
        params: {
          itemName: (after.name as string) ?? "",
          currentStock: (after.currentStock as number) ?? 0,
          unit: (after.unit as string) ?? "",
        },
        link: "/dashboard/stock",
      });
    } catch (error) {
      logger.error("notifyOnLowStock: failed to create notification", { tenantId, stockId, error });
    }
  }
);

// ─── ৩ ও ৪. আজকের ডেলিভারি + বকেয়া সতর্কতা — scheduled দৈনিক সকাল ৯টা (Asia/Dhaka) ──
//
// blueprint ১৪.১০: "আজকের ডেলিভারি (সকাল ৯টায়)"। "বকেয়া সতর্কতা"-র জন্য এই
// সেশনের সিদ্ধান্ত: মেয়াদ পেরিয়ে যাওয়া অথচ এখনো বকেয়া আছে এমন অর্ডারগুলোর
// দৈনিক সারাংশ (blueprint-এ এর সুনির্দিষ্ট ট্রিগার সংজ্ঞায়িত নেই, তাই সবচেয়ে
// কার্যকর ব্যাখ্যাটি বেছে নেওয়া হয়েছে)। উভয়ই একই দৈনিক রানে, প্রতি শাখায়।
// Deterministic doc ID (তারিখ+শাখা ভিত্তিক) দিয়ে idempotent — Cloud Scheduler
// রিট্রাই করলেও ডুপ্লিকেট নোটিফিকেশন তৈরি হয় না।
export const sendDailyNotifications = functions
  .region("asia-south1")
  .pubsub.schedule("0 9 * * *")
  .timeZone("Asia/Dhaka")
  .onRun(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const dateKey = todayStart.toISOString().slice(0, 10);

    const todayStartTs = admin.firestore.Timestamp.fromDate(todayStart);
    const todayEndTs = admin.firestore.Timestamp.fromDate(todayEnd);

    const tenantsSnap = await db.collection("tenants").get();
    let notificationsCreated = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const branchesSnap = await db.collection("tenants").doc(tenantId).collection("branches").get();
      if (branchesSnap.empty) continue;

      for (const branchDoc of branchesSnap.docs) {
        const branchId = branchDoc.id;
        const ordersRef = db.collection("tenants").doc(tenantId).collection("orders");

        // আজকের ডেলিভারি — একই কম্পোজিট ইনডেক্স (branchId, deletedAt, expectedDeliveryDate) পুনরায় ব্যবহৃত।
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
        const overdueSnap = await ordersRef
          .where("branchId", "==", branchId)
          .where("deletedAt", "==", null)
          .where("expectedDeliveryDate", "<", todayStartTs)
          .get();

        const dueAlertCount = overdueSnap.docs.filter((d) => {
          const data = d.data();
          const status = data.status as string;
          const dueAmount = (data.dueAmount as number) ?? 0;
          return status !== "delivered" && status !== "cancelled" && dueAmount > 0;
        }).length;

        if (dueAlertCount > 0) {
          await createNotification(
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
      logger.info(`sendDailyNotifications: created ${notificationsCreated} notification(s) across ${tenantsSnap.size} tenant(s)`);
    }
  });
