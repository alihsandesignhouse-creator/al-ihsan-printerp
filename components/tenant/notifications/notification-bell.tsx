"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Bell, Package, CalendarClock, Wallet, TrendingDown, AlertTriangle, CheckCheck, BellOff } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/firebase/notifications";
import { formatDateTimeLocalized } from "@/lib/utils/format";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import type { AppNotification, NotificationType } from "@/lib/types/notification";

const TYPE_ICONS: Record<NotificationType, typeof Package> = {
  new_order: Package,
  todays_delivery: CalendarClock,
  due_alert: Wallet,
  low_stock: TrendingDown,
  notification_failed: AlertTriangle,
};

function formatTimestamp(notification: AppNotification, locale: string): string {
  const date = notification.createdAt?.toDate?.();
  if (!date) return "";
  return formatDateTimeLocalized(date, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** blueprint ১৪.১০: "In-App নোটিফিকেশন (Bell আইকন)"। শুধু TENANT_ADMIN/BRANCH_MANAGER — top-navbar.tsx-এ role গার্ড করা আছে। */
export function NotificationBell() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const uid = user?.uid ?? null;
  const role = user?.claims.role;
  const branchId = user?.claims.branchId ?? null;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const handleFirestoreError = useFirestoreErrorHandler();

  useEffect(() => {
    if (!tenantId || !(role === "tenant_admin" || role === "branch_manager")) return;
    const unsub = subscribeNotifications(tenantId, role, branchId, setNotifications, handleFirestoreError());
    return unsub;
  }, [tenantId, role, branchId, handleFirestoreError]);

  if (!tenantId || !uid || !(role === "tenant_admin" || role === "branch_manager")) {
    return null;
  }

  const unreadCount = notifications.filter((n) => !n.readBy.includes(uid)).length;

  async function handleNotificationClick(notification: AppNotification) {
    if (!notification.readBy.includes(uid!)) {
      await markNotificationRead(tenantId!, notification.id, uid!);
    }
    setOpen(false);
    if (notification.link) router.push(notification.link);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(tenantId!, notifications, uid!);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t("notifications.title")}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-50"
      >
        <Bell className="h-4.5 w-4.5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-medium leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-neutral-200 bg-white shadow-md">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2.5">
            <span className="text-sm font-semibold text-neutral-900">{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellOff className="h-6 w-6 text-neutral-300" aria-hidden="true" />
                <p className="text-sm text-neutral-400">{t("notifications.empty")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {notifications.map((notification) => {
                  const Icon = TYPE_ICONS[notification.type];
                  const isUnread = !notification.readBy.includes(uid);
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-50 ${
                          isUnread ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isUnread ? "bg-brand-primary/10 text-brand-primary" : "bg-neutral-100 text-neutral-400"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="flex-1">
                          <span className={`block text-sm ${isUnread ? "font-medium text-neutral-900" : "text-neutral-600"}`}>
                            {t(notification.titleKey, notification.params)}
                          </span>
                          <span className="mt-0.5 block text-xs text-neutral-400">{formatTimestamp(notification, locale)}</span>
                        </span>
                        {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
