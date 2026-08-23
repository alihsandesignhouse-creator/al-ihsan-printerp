"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDateTimeLocalized } from "@/lib/utils/format";
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, History } from "lucide-react";
import type { StockTransaction, StockTransactionType } from "@/lib/types/stock";
import { STOCK_TRANSACTION_CLASSES } from "@/lib/constants/status-colors";

interface StockTransactionHistoryProps {
  transactions: StockTransaction[];
  unit: string;
  isLoading: boolean;
}

const TYPE_ICON: Record<StockTransactionType, typeof ArrowDownToLine> = {
  in: ArrowDownToLine,
  out: ArrowUpFromLine,
  adjustment: SlidersHorizontal,
};

function formatDateTime(tx: StockTransaction, locale: string): string {
  const date = tx.createdAt?.toDate?.();
  if (!date) return "";
  return formatDateTimeLocalized(date, locale);
}

export function StockTransactionHistory({ transactions, unit, isLoading }: StockTransactionHistoryProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <History className="h-7 w-7 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("stock.noTransactionsFound")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("stock.dateTime")}</th>
              <th className="px-4 py-2.5">{t("stock.transactionType")}</th>
              <th className="px-4 py-2.5">{t("stock.change")}</th>
              <th className="px-4 py-2.5">{t("stock.resultingStock")}</th>
              <th className="px-4 py-2.5">{t("stock.performedBy")}</th>
              <th className="px-4 py-2.5">{t("stock.note")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {transactions.map((tx) => {
              const Icon = TYPE_ICON[tx.type];
              return (
                <tr key={tx.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-600">{formatDateTime(tx, locale)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${STOCK_TRANSACTION_CLASSES[tx.type]}`}>
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {t(`stock.type.${tx.type}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className={tx.delta >= 0 ? "text-emerald-600" : "text-status-danger"}>
                      {tx.delta >= 0 ? "+" : ""}
                      {tx.delta} {unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-neutral-900">
                    {tx.newStock} {unit}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{tx.performedByName || "—"}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-neutral-500">{tx.note || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
