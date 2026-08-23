"use client";

import { useTranslations } from "next-intl";
import { GitCompare } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { BranchComparisonRow } from "@/lib/types/report";

interface BranchComparisonTableProps {
  rows: BranchComparisonRow[];
  isLoading: boolean;
}

/** blueprint T-18: "শাখাওয়ারি KPI — Tenant Admin তুলনামূলক রিপোর্ট দেখবেন"। ১টির বেশি শাখা থাকলেই কার্যকর — না হলে page.tsx রেন্ডার করে না। */
export function BranchComparisonTable({ rows, isLoading }: BranchComparisonTableProps) {
  const t = useTranslations();

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <GitCompare className="h-7 w-7 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("reports.noData")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("reports.branch")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.orderCount")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.totalRevenue")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.grossProfit")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.netProfit")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.totalDue")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr key={row.branchId} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-900">{row.branchName}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{row.orderCount}</td>
                <td className="px-4 py-3 text-right font-mono text-neutral-900">{formatTaka(row.totalRevenue)}</td>
                <td
                  className={`px-4 py-3 text-right font-mono ${row.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {formatTaka(row.grossProfit)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono ${row.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {formatTaka(row.netProfit)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-red-600">{formatTaka(row.totalDue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
