"use client";

import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { CommissionSummaryRow } from "@/lib/types/commission";

interface CommissionSummaryTableProps {
  rows: CommissionSummaryRow[];
  isLoading: boolean;
}

export function CommissionSummaryTable({ rows, isLoading }: CommissionSummaryTableProps) {
  const t = useTranslations();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <TrendingUp className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("commission.noStaffFound")}</p>
      </div>
    );
  }

  const totalCommission = rows.reduce((sum, r) => sum + r.commissionAmount, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">{t("commission.staffName")}</th>
              <th className="px-4 py-3 text-right">{t("commission.costedOrderCount")}</th>
              <th className="px-4 py-3 text-right">{t("commission.totalBilled")}</th>
              <th className="px-4 py-3 text-right">{t("commission.totalCosting")}</th>
              <th className="px-4 py-3 text-right">{t("commission.grossProfit")}</th>
              <th className="px-4 py-3 text-right">{t("commission.rate")}</th>
              <th className="px-4 py-3 text-right">{t("commission.commissionAmount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr key={row.staffId} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-900">{row.staffName}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{row.costedOrderCount}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{formatTaka(row.totalBilled)}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{formatTaka(row.totalCosting)}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{formatTaka(row.grossProfit)}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{row.commissionRate}%</td>
                <td className="px-4 py-3 text-right font-semibold text-brand-primary">
                  {formatTaka(row.commissionAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-neutral-200 bg-neutral-50">
            <tr>
              <td className="px-4 py-3 font-semibold text-neutral-700" colSpan={6}>
                {t("commission.totalCommission")}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                {formatTaka(totalCommission)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
