"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserCog } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { StaffPerformanceRow } from "@/lib/types/report";

interface StaffPerformanceTableProps {
  rows: StaffPerformanceRow[];
  isLoading: boolean;
}

/**
 * blueprint T-18: "স্টাফ কর্মক্ষমতা: অর্ডার, কমিশন, কালেকশন তুলনা"।
 * Drilldown (সেশন ৬): সারিতে ক্লিক করলে অর্ডার তালিকায় ওই স্টাফের অর্ডার
 * দিয়ে ফিল্টার প্রি-সিলেক্ট হয়ে যায় (?staffId=)।
 */
export function StaffPerformanceTable({ rows, isLoading }: StaffPerformanceTableProps) {
  const t = useTranslations();
  const router = useRouter();

  function goToOrders(staffId: string) {
    router.push(`/dashboard/orders?staffId=${encodeURIComponent(staffId)}`);
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <UserCog className="h-7 w-7 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("reports.noData")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("reports.staffName")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.orderCount")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.totalRevenue")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.totalCollection")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.commissionAmount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr
                key={row.staffId}
                role="button"
                tabIndex={0}
                onClick={() => goToOrders(row.staffId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") goToOrders(row.staffId);
                }}
                className="cursor-pointer hover:bg-neutral-50"
              >
                <td className="px-4 py-3 font-medium text-neutral-900">{row.staffName}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{row.orderCount}</td>
                <td className="px-4 py-3 text-right font-mono text-neutral-900">{formatTaka(row.totalRevenue)}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatTaka(row.totalCollection)}</td>
                <td className="px-4 py-3 text-right font-mono text-neutral-600">
                  {row.commissionAmount === null ? "—" : formatTaka(row.commissionAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
