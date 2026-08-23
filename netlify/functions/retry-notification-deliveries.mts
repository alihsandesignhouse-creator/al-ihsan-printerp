import type { Config } from "@netlify/functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../../lib/firebase/admin";
import { sendSmsViaGateway } from "../../lib/server/sms-gateway";
import { sendEmailViaResend } from "../../lib/server/email-gateway";
import { MAX_NOTIFICATION_ATTEMPTS, NOTIFICATION_RETRY_DELAY_MINUTES } from "../../lib/types/notification-delivery";

/**
 * netlify/functions/retry-notification-deliveries.mts
 *
 * Free Edition Phase F3 — the scheduled half of the SMS/Email retry queue
 * blueprint section ১৩.৩ describes:
 *   ১. Firestore retry queue-তে যোগ           (done in send-sms/send-email routes)
 *   ২. ৩০ মিনিট পর পুনরায় চেষ্টা (সর্বোচ্চ ৩ বার)  ← this function
 *   ৩. ৩ বার ব্যর্থ: in-app notification + Audit Log ← this function
 *
 * Runs every 30 minutes. Iterates every tenant (same per-tenant-loop
 * pattern as check-quotation-expiry.mts / check-trial-expiry.mts, chosen
 * specifically to avoid needing a COLLECTION_GROUP composite index — a
 * plain per-tenant subcollection query only needs the COLLECTION-scope
 * index already declared in firestore.indexes.json for
 * notification_deliveries), retries every `status == "pending"` delivery
 * whose `nextRetryAt <= now`.
 *
 * On success: status → "sent".
 * On failure, attempts < 3: attempts++, nextRetryAt pushed another 30 min.
 * On failure, attempts reaches 3: status → "failed", nextRetryAt → null,
 *   plus an in-app Bell notification (type "notification_failed") and an
 *   audit_logs entry — both written with a "system" actor since this runs
 *   with no signed-in user (Admin SDK bypasses Security Rules entirely).
 */

export default async (req: Request) => {
  const { next_run } = (await req.json()) as { next_run?: string };
  if (process.env.NODE_ENV !== "production") {
    console.info("[retry-notification-deliveries] running, next run at:", next_run);
  }

  const db = getAdminDb();
  const now = Timestamp.now();
  const tenantsSnap = await db.collection("tenants").get();

  let totalRetried = 0;
  let totalPermanentlyFailed = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const pendingSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("notification_deliveries")
      .where("status", "==", "pending")
      .where("nextRetryAt", "<=", now)
      .limit(50)
      .get();

    if (pendingSnap.empty) continue;

    for (const deliveryDoc of pendingSnap.docs) {
      const delivery = deliveryDoc.data();
      totalRetried += 1;

      const result =
        delivery.channel === "sms"
          ? await sendSmsViaGateway(delivery.recipient as string, delivery.content as string)
          : await sendEmailViaResend(
              delivery.recipient as string,
              (delivery.subject as string) ?? "",
              delivery.content as string
            );

      const attempts = ((delivery.attempts as number) ?? 1) + 1;

      if (result.ok) {
        await deliveryDoc.ref.update({
          status: "sent",
          attempts,
          lastError: null,
          nextRetryAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        continue;
      }

      if (attempts >= MAX_NOTIFICATION_ATTEMPTS) {
        await deliveryDoc.ref.update({
          status: "failed",
          attempts,
          lastError: result.error ?? "unknown error",
          nextRetryAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        totalPermanentlyFailed += 1;

        // ── In-app Bell notification (blueprint ১৩.৩ পয়েন্ট ৩) ──────────
        const notifRef = db
          .collection("tenants")
          .doc(tenantId)
          .collection("notifications")
          .doc(`notifFailed_${deliveryDoc.id}`);
        await notifRef.set({
          id: notifRef.id,
          tenantId,
          branchId: delivery.branchId,
          type: "notification_failed",
          titleKey: "notifications.messages.deliveryFailed",
          params: {
            channel: delivery.channel === "sms" ? "SMS" : "Email",
            recipient: delivery.recipient ?? "",
          },
          link: delivery.relatedOrderId ? `/dashboard/orders/${delivery.relatedOrderId}` : null,
          readBy: [],
          createdAt: FieldValue.serverTimestamp(),
        });

        // ── Audit log (blueprint ১৩.৩ পয়েন্ট ৩ + ১১.৬) ──────────────────
        const auditRef = db.collection("tenants").doc(tenantId).collection("audit_logs").doc();
        await auditRef.set({
          id: auditRef.id,
          tenantId,
          userId: "system",
          userEmail: "system@scheduled-function",
          action: "notification.delivery_failed",
          resourceType: "notification_delivery",
          resourceId: deliveryDoc.id,
          changes: {
            channel: delivery.channel,
            event: delivery.event,
            recipient: delivery.recipient,
            attempts,
            lastError: result.error ?? "unknown error",
          },
          ipAddress: "",
          userAgent: "netlify-scheduled-function",
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        const nextRetryAt = Timestamp.fromMillis(Date.now() + NOTIFICATION_RETRY_DELAY_MINUTES * 60_000);
        await deliveryDoc.ref.update({
          status: "pending",
          attempts,
          lastError: result.error ?? "unknown error",
          nextRetryAt,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[retry-notification-deliveries] retried ${totalRetried}, permanently failed ${totalPermanentlyFailed}`
    );
  }
};

export const config: Config = {
  schedule: "*/30 * * * *",
};
