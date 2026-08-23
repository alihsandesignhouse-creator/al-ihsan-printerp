"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDateLocalized } from "@/lib/utils/format";
import { Wallet } from "lucide-react";
import { WithdrawalStatusBadge } from "./withdrawal-status-badge";
import { formatTaka } from "@/lib/utils/calculations";
import type { StaffWithdrawal } from "@/lib/types/commission";

interface WithdrawalListTableProps {
  withdrawals: StaffWithdrawal[];
  isLoading: boolean;
  /** admin: staff name column + approve/reject action; staff: no name column, no action */
  mode: "admin" | "staff";
  onProcess?: (withdrawal: StaffWithdrawal) => void;
}

function formatDate(w: StaffWithdrawal, locale: string): string {
  const date = w.requestedAt?.toDate?.();
  if (!date) return "";
  return formatDateLocalized(date, locale);
}

export function WithdrawalListTable({ withdrawals, isLoading, mode, onProcess }: WithdrawalListTableProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <Wallet className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("commission.noWithdrawals")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              {mode === "admin" && <th className="px-4 py-3">{t("commission.staffName")}</th>}
              <th className="px-4 py-3">{t("commission.withdrawalTypeLabel")}</th>
              <th className="px-4 py-3">{t("commission.requestDate")}</th>
              <th className="px-4 py-3 text-right">{t("commission.amount")}</th>
              <th className="px-4 py-3">{t("commission.status")}</th>
              {mode === "admin" && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {withdrawals.map((w) => (
              <tr key={w.id} className="hover:bg-neutral-50">
                {mode === "admin" && (
                  <td className="px-4 py-3 font-medium text-neutral-900">{w.staffName}</td>
                )}
                <td className="px-4 py-3 text-neutral-600">
                  {t(`commission.withdrawalType.${w.type}`)}
                  {w.type === "commission" && w.month && (
                    <span className="ml-1 text-xs text-neutral-400">({w.month})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600">{formatDate(w, locale)}</td>
                <td className="px-4 py-3 text-right text-neutral-700">
                  {formatTaka(w.amount)}
                  {w.editedByAdmin && (
                    <span
                      className="ml-1 text-xs text-amber-600"
                      title={t("commission.editedByAdminHint", { amount: formatTaka(w.requestedAmount) })}
                    >
                      *
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <WithdrawalStatusBadge status={w.status} />
                </td>
                {mode === "admin" && (
                  <td className="px-4 py-3 text-right">
                    {w.status === "pending" && onProcess && (
                      <button
                        type="button"
                        onClick={() => onProcess(w)}
                        className="text-xs font-medium text-brand-primary hover:underline"
                      >
                        {t("commission.review")}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
