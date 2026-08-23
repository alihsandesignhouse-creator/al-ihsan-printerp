import type { Timestamp } from "firebase/firestore";

/**
 * /tenants/{tenantId}/notification_deliveries/{deliveryId}
 *
 * Tracks every SMS/Email send attempt so the Netlify Scheduled Function
 * (`netlify/functions/retry-notification-deliveries.mts`) can retry failed
 * sends per blueprint section ১৩.৩ ("SMS Failure"):
 *   ১. Firestore retry queue-তে যোগ
 *   ২. ৩০ মিনিট পর পুনরায় চেষ্টা (সর্বোচ্চ ৩ বার)
 *   ৩. ৩ বার ব্যর্থ: in-app notification + Audit Log
 *
 * Written by app/api/notifications/send-sms and send-email (initial attempt,
 * via firebase-admin) and updated by the scheduled retry function — never
 * written directly from the browser, so there is no corresponding
 * lib/firebase/*.ts client helper for this collection.
 */
export type NotificationChannel = "sms" | "email" | "whatsapp";

/**
 * Events that drive the tenant-editable SMS/Email free-text template
 * system (lib/server/plan-features.ts's NotificationTemplates, rendered
 * via lib/server/notification-events.ts). WhatsApp does NOT use this —
 * Meta requires a single pre-approved Message Template (see
 * lib/server/whatsapp-gateway.ts), so a WhatsApp send has no per-event
 * template variant here. See NotificationDelivery.event below for how a
 * WhatsApp delivery record's event value is typed instead.
 */
export type NotificationEvent =
  | "orderConfirmation"
  | "paymentReceived"
  | "deliveryReminder"
  | "dueReminder";

export type NotificationDeliveryStatus = "sent" | "pending" | "failed";

export interface NotificationDelivery {
  id: string;
  tenantId: string;
  branchId: string;
  channel: NotificationChannel;
  /** For channel "whatsapp" this is always "manualWhatsapp" (not part of NotificationEvent — see that type's doc comment). */
  event: NotificationEvent | "manualWhatsapp";
  /** Phone number (SMS) or email address (Email). */
  recipient: string;
  /** Rendered message body (SMS text, or Email HTML). */
  content: string;
  /** Email only — null for SMS. */
  subject: string | null;
  relatedOrderId: string | null;
  status: NotificationDeliveryStatus;
  attempts: number;
  lastError: string | null;
  /** Set only while status === "pending"; null once sent or permanently failed. */
  nextRetryAt: Timestamp | null;
  /** WhatsApp (manual-send) only — uid of the staff member who clicked "পাঠান". Undefined for auto-triggered SMS/Email deliveries. */
  sentBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const MAX_NOTIFICATION_ATTEMPTS = 3;
export const NOTIFICATION_RETRY_DELAY_MINUTES = 30;
