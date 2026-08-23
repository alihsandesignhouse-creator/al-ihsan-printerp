"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Package } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { ItemAnalysisResult } from "@/lib/types/report";

interface ItemAnalysisTableProps {
  result: ItemAnalysisResult;
  isLoading: boolean;
}

/**
 * blueprint T-18: "আইটেম বিশ্লেষণ: কোন আইটেম কতো, শীর্ষ ৫"।
 * Drilldown (সেশন ৬): সারিতে ক্লিক করলে অর্ডার তালিকায় ওই আইটেমের নাম দিয়ে
 * সার্চ প্রি-ফিল হয়ে যায় (?q=)।
 */
export function ItemAnalysisTable({ result, isLoading }: ItemAnalysisTableProps) {
  const t = useTranslations();
  const router = useRouter();

  function goToOrders(itemName: string) {
    router.push(`/dashboard/orders?q=${encodeURIComponent(itemName)}`);
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />;
  }

  if (result.rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <Package className="h-7 w-7 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("reports.noData")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("reports.itemName")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.itemOrderCount")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.itemQuantity")}</th>
              <th className="px-4 py-2.5 text-right">{t("reports.totalRevenue")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {result.rows.map((row) => (
              <tr
                key={row.itemName}
                role="button"
                tabIndex={0}
                onClick={() => goToOrders(row.itemName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") goToOrders(row.itemName);
                }}
                className="cursor-pointer hover:bg-neutral-50"
              >
                <td className="px-4 py-3 font-medium text-neutral-900">{row.itemName}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{row.orderCount}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{row.totalQuantity}</td>
                <td className="px-4 py-3 text-right font-mono text-neutral-900">{formatTaka(row.totalRevenue)}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
      {result.isCapped && (
        <p className="mt-2 text-xs text-neutral-400">
          {t("reports.itemAnalysisCapped", { scanned: result.ordersScanned, total: result.totalOrdersInRange })}
        </p>
      )}
    </div>
  );
}
