"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { LogIn, LogOut, MonitorSmartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOwnLoginHistory } from "@/lib/firebase/profile";
import type { AuditLog } from "@/lib/types/tenant";
import { LOGIN_EVENT_CLASS, LOGOUT_EVENT_CLASS } from "@/lib/constants/status-colors";

interface LoginHistoryListProps {
  tenantId: string;
  uid: string;
}

function formatDeviceLabel(userAgent: string): string {
  if (!userAgent) return "—";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad/i.test(userAgent)) return "iOS";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return userAgent.slice(0, 40);
}

export function LoginHistoryList({ tenantId, uid }: LoginHistoryListProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOwnLoginHistory(tenantId, uid)
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, uid]);

  if (error) {
    return <p className="text-sm text-status-danger">{t("profile.history.loadFailed")}</p>;
  }

  if (logs === null) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return <p className="text-sm text-neutral-500">{t("profile.history.empty")}</p>;
  }

  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
      {logs.map((log) => {
        const isLogin = log.action === "auth.login";
        const date = log.createdAt.toDate();
        return (
          <li key={log.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                isLogin ? LOGIN_EVENT_CLASS : LOGOUT_EVENT_CLASS
              }`}
            >
              {isLogin ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900">
                {isLogin ? t("profile.history.login") : t("profile.history.logout")}
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-neutral-500">
                <MonitorSmartphone className="h-3 w-3 shrink-0" />
                {formatDeviceLabel(log.userAgent)}
                {log.ipAddress ? ` · ${log.ipAddress}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-xs text-neutral-500">
              {date.toLocaleString(locale === "bn" ? "bn-BD" : "en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
