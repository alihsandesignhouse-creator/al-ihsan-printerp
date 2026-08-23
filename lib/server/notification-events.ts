import type { NotificationEvent } from "@/lib/types/notification-delivery";
import type { NotificationTemplates } from "@/lib/server/plan-features";

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  "orderConfirmation",
  "paymentReceived",
  "deliveryReminder",
  "dueReminder",
];

/** Email subject lines — templates themselves only contain the body text. */
export const EVENT_EMAIL_SUBJECTS: Record<NotificationEvent, string> = {
  orderConfirmation: "আপনার অর্ডার নিশ্চিত হয়েছে",
  paymentReceived: "পেমেন্ট গৃহীত হয়েছে",
  deliveryReminder: "আপনার অর্ডার ডেলিভারির জন্য প্রস্তুত",
  dueReminder: "বকেয়া পরিশোধের অনুরোধ",
};

export function getSmsTemplate(templates: NotificationTemplates, event: NotificationEvent): string {
  return templates.sms[event];
}

export function getEmailTemplate(templates: NotificationTemplates, event: NotificationEvent): string {
  return templates.email[event];
}
