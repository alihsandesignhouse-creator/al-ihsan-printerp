import type { Timestamp } from "firebase/firestore";

// ─── In-App নোটিফিকেশন — blueprint ১৪.১০ ────────────────────────────────────
// /tenants/{tenantId}/notifications/{notificationId} — শুধু Cloud Functions
// (Admin SDK) থেকে তৈরি হয়, ক্লায়েন্ট থেকে শুধু readBy আপডেট করা যায়
// (দেখুন functions/src/notificationFunctions.ts ও firestore.rules)।

export type NotificationType = "new_order" | "todays_delivery" | "due_alert" | "low_stock" | "notification_failed";

export interface AppNotification {
  id: string;
  tenantId: string;
  /** সব নোটিফিকেশন উৎস (orders, stock_items, branches) সবসময় একটি real branchId বহন করে — tenant-wide/null কেস এই সিস্টেমে ঘটে না। */
  branchId: string;
  type: NotificationType;
  /** next-intl key — নির্দিষ্ট ভাষায় প্রি-রেন্ডার করা টেক্সট সংরক্ষণ করা হয় না। */
  titleKey: string;
  params: Record<string, string | number>;
  link: string | null;
  readBy: string[];
  createdAt: Timestamp;
}
