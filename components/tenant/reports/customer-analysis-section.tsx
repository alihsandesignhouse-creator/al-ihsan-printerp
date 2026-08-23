"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { RangeCustomerLeaderboards, CustomerDueRow, InactiveCustomerRow } from "@/lib/types/report";

interface CustomerAnalysisSectionProps {
  leaderboards: RangeCustomerLeaderboards;
  topDueCustomers: CustomerDueRow[];
  inactiveCustomers: InactiveCustomerRow[];
  isLoading: boolean;
}

function MiniList<T>({
  title,
  rows,
  renderRow,
  emptyLabel,
}: {
  title: string;
  rows: T[];
  renderRow: (row: T, index: number) => ReactNode;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100">{rows.map((row, i) => renderRow(row, i))}</ul>
      )}
    </div>
  );
}

/** blueprint T-18: "কাস্টমার বিশ্লেষণ: শীর্ষ ৫ (অর্ডার/টাকা), সর্বোচ্চ বকেয়া, নিষ্ক্রিয়"। */
export function CustomerAnalysisSection({
  leaderboards,
  topDueCustomers,
  inactiveCustomers,
  isLoading,
}: CustomerAnalysisSectionProps) {
  const t = useTranslations();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MiniList
        title={t("reports.topCustomersByOrders")}
        rows={leaderboards.byOrderCount}
        emptyLabel={t("reports.noData")}
        renderRow={(row, i) => (
          <li key={row.customerId}>
            <Link
              href={`/dashboard/customers/${row.customerId}`}
              className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-neutral-50"
            >
              <span className="truncate text-neutral-700">
                {i + 1}. {row.customerName}
              </span>
              <span className="shrink-0 font-mono text-neutral-500">{row.orderCount}</span>
            </Link>
          </li>
        )}
      />
      <MiniList
        title={t("reports.topCustomersByAmount")}
        rows={leaderboards.byAmount}
        emptyLabel={t("reports.noData")}
        renderRow={(row, i) => (
          <li key={row.customerId}>
            <Link
              href={`/dashboard/customers/${row.customerId}`}
              className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-neutral-50"
            >
              <span className="truncate text-neutral-700">
                {i + 1}. {row.customerName}
              </span>
              <span className="shrink-0 font-mono text-neutral-500">{formatTaka(row.totalAmount)}</span>
            </Link>
          </li>
        )}
      />
      <MiniList
        title={t("reports.topDueCustomers")}
        rows={topDueCustomers}
        emptyLabel={t("reports.noData")}
        renderRow={(row, i) => (
          <li key={row.customerId}>
            <Link
              href={`/dashboard/customers/${row.customerId}`}
              className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-neutral-50"
            >
              <span className="truncate text-neutral-700">
                {i + 1}. {row.customerName}
              </span>
              <span className="shrink-0 font-mono text-red-600">{formatTaka(row.totalDue)}</span>
            </Link>
          </li>
        )}
      />
      <MiniList
        title={t("reports.inactiveCustomers")}
        rows={inactiveCustomers}
        emptyLabel={t("reports.noData")}
        renderRow={(row, i) => (
          <li key={row.customerId}>
            <Link
              href={`/dashboard/customers/${row.customerId}`}
              className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-neutral-50"
            >
              <span className="truncate text-neutral-700">
                {i + 1}. {row.customerName}
              </span>
              <span className="shrink-0 text-xs text-neutral-500">
                {row.daysSinceLastOrder === null
                  ? t("reports.neverOrdered")
                  : t("reports.daysInactive", { days: row.daysSinceLastOrder })}
              </span>
            </Link>
          </li>
        )}
      />
      {leaderboards.byOrderCount.length === 0 &&
        leaderboards.byAmount.length === 0 &&
        topDueCustomers.length === 0 &&
        inactiveCustomers.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center">
            <Users className="h-7 w-7 text-neutral-300" aria-hidden="true" />
          </div>
        )}
    </div>
  );
}
