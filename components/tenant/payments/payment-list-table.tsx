"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { formatDateLocalized } from "@/lib/utils/format";
import { Receipt, Printer } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { Payment } from "@/lib/types/dashboard";
import type { Branch } from "@/lib/types/dashboard";

interface PaymentListTableProps {
  payments: Payment[];
  branches: Branch[];
  isLoading: boolean;
  onPrintReceipt: (payment: Payment) => void;
}

const METHOD_LABEL_KEYS: Record<Payment["paymentMethod"], string> = {
  cash: "orders.paymentMethod.cash",
  bkash: "orders.paymentMethod.bkash",
  nagad: "orders.paymentMethod.nagad",
  rocket: "orders.paymentMethod.rocket",
  bank: "orders.paymentMethod.bank",
  cheque: "orders.paymentMethod.cheque",
};

function formatDate(ts: Payment["paymentDate"], locale: string): string {
  const date = ts?.toDate?.();
  if (!date) return "—";
  return formatDateLocalized(date, locale);
}

/**
 * Module T-05 (audit item #3): tenant-wide পেমেন্ট লেজার টেবিল।
 * customer-payment-ledger-tab.tsx-এর সাথে ইচ্ছাকৃতভাবে একই কলাম-স্টাইল
 * ও রিসিট-রিপ্রিন্ট প্যাটার্ন, কিন্তু এখানে সব কাস্টমার/অর্ডার একসাথে
 * বলে গ্রাহকের নাম ও শাখা কলাম যোগ — Payment.orderNumber/customerName
 * এখন recordPayment()-এ denormalized থাকে বলে কোনো আলাদা join লাগে না।
 */
export function PaymentListTable({ payments, branches, isLoading, onPrintReceipt }: PaymentListTableProps) {
  const t = useTranslations();
  const locale = useLocale();

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <Receipt className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("payments.noPaymentsFound")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("customers.paymentDate")}</th>
              <th className="px-4 py-2.5">{t("orders.orderNumber")}</th>
              <th className="px-4 py-2.5">{t("orders.customer")}</th>
              <th className="px-4 py-2.5">{t("expenses.branch")}</th>
              <th className="px-4 py-2.5">{t("orders.paymentMethodLabel")}</th>
              <th className="px-4 py-2.5 text-right">{t("customers.amount")}</th>
              <th className="px-4 py-2.5 text-right">
                <span className="sr-only">{t("orders.printReceiptAction")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                  {formatDate(payment.paymentDate, locale)}
                </td>
                <td className="px-4 py-3 font-mono text-neutral-600">
                  <Link
                    href={`/dashboard/orders/${payment.orderId}`}
                    className="hover:text-brand-primary hover:underline"
                  >
                    {payment.orderNumber ?? payment.orderId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  <div>{payment.customerName ?? "—"}</div>
                  {payment.customerPhone && (
                    <div className="text-xs text-neutral-400">{payment.customerPhone}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600">{branchNameById.get(payment.branchId) ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{t(METHOD_LABEL_KEYS[payment.paymentMethod])}</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-emerald-700">
                  {formatTaka(payment.amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onPrintReceipt(payment)}
                    aria-label={t("orders.printReceiptAction")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    <Printer className="h-4 w-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
