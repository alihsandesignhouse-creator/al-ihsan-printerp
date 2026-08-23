import { collection, query, where, orderBy, limit as fsLimit, onSnapshot, doc, updateDoc, arrayUnion, type Unsubscribe } from "firebase/firestore";
import { db } from "./client";
import type { AppNotification } from "@/lib/types/notification";

const NOTIFICATION_LIMIT = 30;

/**
 * TENANT_ADMIN সব শাখার নোটিফিকেশন দেখেন; BRANCH_MANAGER শুধু নিজের শাখার
 * নোটিফিকেশন দেখেন। কোয়েরির আকৃতি firestore.rules-এর read rule-এর সাথে
 * হুবহু মিলিয়ে রাখা হয়েছে (Firestore-এ একটি query-র ফলাফলের প্রতিটি
 * ডকুমেন্ট rule পাস করতে হয়, নাহলে পুরো query প্রত্যাখ্যাত হয়)।
 */
export function subscribeNotifications(
  tenantId: string,
  role: "tenant_admin" | "branch_manager",
  branchId: string | null,
  callback: (notifications: AppNotification[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "notifications");

  const q =
    role === "tenant_admin"
      ? query(colRef, orderBy("createdAt", "desc"), fsLimit(NOTIFICATION_LIMIT))
      : query(colRef, where("branchId", "==", branchId), orderBy("createdAt", "desc"), fsLimit(NOTIFICATION_LIMIT));

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification)),
    (error) => onError(error as Error)
  );
}

export async function markNotificationRead(tenantId: string, notificationId: string, uid: string): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "notifications", notificationId);
  await updateDoc(ref, { readBy: arrayUnion(uid) });
}

export async function markAllNotificationsRead(tenantId: string, notifications: AppNotification[], uid: string): Promise<void> {
  const unread = notifications.filter((n) => !n.readBy.includes(uid));
  await Promise.all(unread.map((n) => markNotificationRead(tenantId, n.id, uid)));
}
