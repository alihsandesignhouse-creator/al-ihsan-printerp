"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDateTimeLocalized } from "@/lib/utils/format";
import { Banknote, History, ShoppingCart } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { SupplierTransaction, SupplierTransactionType } from "@/lib/types/supplier";
import { SUPPLIER_TRANSACTION_CLASSES } from "@/lib/constants/status-colors";

interface SupplierLedgerHistoryProps {
  transactions: SupplierTransaction[];
  isLoading: boolean;
}

const TYPE_ICON: Record<SupplierTransactionType, typeof ShoppingCart> = {
  purchase: ShoppingCart,
  payment: Banknote,
};

function formatDateTime(tx: SupplierTransaction, locale: string): string {
  const date = tx.createdAt?.toDate?.();
  if (!date) return "";
  return formatDateTimeLocalized(date, locale);
}

export function SupplierLedgerHistory({ transactions, isLoading }: SupplierLedgerHistoryProps) {
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
        <p className="text-sm text-neutral-400">{t("suppliers.noTransactionsFound")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("suppliers.dateTime")}</th>
              <th className="px-4 py-2.5">{t("suppliers.transactionType")}</th>
              <th className="px-4 py-2.5">{t("suppliers.amount")}</th>
              <th className="px-4 py-2.5">{t("suppliers.resultingDue")}</th>
              <th className="px-4 py-2.5">{t("suppliers.performedBy")}</th>
              <th className="px-4 py-2.5">{t("suppliers.note")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {transactions.map((tx) => {
              const Icon = TYPE_ICON[tx.type];
              return (
                <tr key={tx.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-600">{formatDateTime(tx, locale)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${SUPPLIER_TRANSACTION_CLASSES[tx.type]}`}>
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {t(`suppliers.type.${tx.type}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className={tx.type === "purchase" ? "text-status-danger" : "text-emerald-600"}>
                      {tx.type === "purchase" ? "+" : "-"}
                      {formatTaka(tx.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-neutral-900">
                    {tx.newDue < 0
                      ? t("suppliers.advanceAmount", { amount: formatTaka(Math.abs(tx.newDue)) })
                      : formatTaka(tx.newDue)}
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
