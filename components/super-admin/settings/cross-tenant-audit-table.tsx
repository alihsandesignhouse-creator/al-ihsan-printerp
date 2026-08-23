"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  History,
  LogIn,
  LogOut,
  ClipboardList,
  CreditCard,
  Receipt,
  HandCoins,
  Settings,
  Building2,
  UserCog,
  ScrollText,
  Bell,
  ExternalLink,
} from "lucide-react";
import { auditActionMessageKey, resolveAuditCategory, type AuditCategory } from "@/lib/types/audit";
import type { AuditLog } from "@/lib/types/audit";

/**
 * components/super-admin/settings/cross-tenant-audit-table.tsx
 *
 * SA-05 Audit Log tab's table — deliberately a sibling of, not a shared
 * component with, components/tenant/audit-log/audit-log-table.tsx: the one
 * meaningful difference is an added "প্রতিষ্ঠান" (tenant/press) column,
 * which would be dead weight/confusing on the tenant_admin-facing page
 * (where every row already belongs to their own single tenant by
 * definition). Everything else — action icon/label, category label, time
 * formatting, "বিস্তারিত" trigger — mirrors that component exactly so the
 * two Audit Log experiences feel like the same feature at two scopes.
 */
interface CrossTenantAuditTableProps {
  logs: AuditLog[];
  tenantNames: Map<string, string>;
  isLoading: boolean;
  onSelect: (log: AuditLog) => void;
}

const CATEGORY_ICONS: Record<AuditCategory, typeof History> = {
  auth: LogIn,
  tenant: Building2,
  user: UserCog,
  order: ClipboardList,
  payment: CreditCard,
  expense: Receipt,
  withdrawal: HandCoins,
  outsource: ExternalLink,
  settings: Settings,
  branch: Building2,
  notification: Bell,
};

function formatDate(log: AuditLog, locale: string): string {
  const date = log.createdAt?.toDate?.();
  if (!date) return "";
  return date.toLocaleString(locale === "bn" ? "bn-BD" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CrossTenantAuditTable({ logs, tenantNames, isLoading, onSelect }: CrossTenantAuditTableProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <ScrollText className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("auditLog.noLogs")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("auditLog.columns.time")}</th>
              <th className="px-4 py-2.5">{t("sa.settingsPage.auditLog.columns.tenant")}</th>
              <th className="px-4 py-2.5">{t("auditLog.columns.user")}</th>
              <th className="px-4 py-2.5">{t("auditLog.columns.action")}</th>
              <th className="px-4 py-2.5">{t("auditLog.columns.category")}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {logs.map((log) => {
              const category = resolveAuditCategory(log.action);
              const Icon = CATEGORY_ICONS[category] ?? History;
              const isLogout = log.action === "auth.logout";
              const tenantName = tenantNames.get(log.tenantId) ?? log.tenantId;
              return (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatDate(log, locale)}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 font-medium text-neutral-800">{tenantName}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-neutral-700">{log.userEmail || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                        {isLogout ? <LogOut className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                      </span>
                      <span className="font-medium text-neutral-900">{t(auditActionMessageKey(log.action))}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{t(`auditLog.category.${category}`)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(log)}
                      className="text-xs font-medium text-brand-primary hover:underline"
                    >
                      {t("auditLog.viewDetails")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
