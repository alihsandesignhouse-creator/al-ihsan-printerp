"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDateLocalized } from "@/lib/utils/format";
import { Printer } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { Payment } from "@/lib/types/customer";
import type { Branch } from "@/lib/types/dashboard";

interface TenantBrandInfo {
  name: string;
  logoUrl: string;
  address: string;
  footerMessage: string;
}

interface PaymentReceiptProps {
  payment: Payment;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  branch: Branch | null;
  tenant: TenantBrandInfo;
}

const METHOD_LABEL_KEYS: Record<Payment["paymentMethod"], string> = {
  cash: "orders.paymentMethod.cash",
  bkash: "orders.paymentMethod.bkash",
  nagad: "orders.paymentMethod.nagad",
  rocket: "orders.paymentMethod.rocket",
  bank: "orders.paymentMethod.bank",
  cheque: "orders.paymentMethod.cheque",
};

function formatDate(value: { toDate?: () => Date } | null | undefined, locale: string): string {
  const date = value?.toDate?.();
  if (!date) return "";
  return formatDateLocalized(date, locale, { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Module T-05 (পেমেন্ট ব্যবস্থাপনা), blueprint: "বকেয়া স্বয়ংক্রিয় আপডেট,
 * পেমেন্ট রিসিট প্রিন্ট"। AUDIT-REPORT-2.md-এ এই ফিচারটির সম্পূর্ণ
 * অনুপস্থিতি চিহ্নিত হয়েছিল — এই কম্পোনেন্ট সেই গ্যাপ বন্ধ করে।
 *
 * `delivery-challan.tsx`-এর সাথে ইচ্ছাকৃতভাবে হুবহু একই গঠন/প্যাটার্ন
 * অনুসরণ করে (একই print button + data-print-content + স্বাক্ষর-ব্লক
 * কনভেনশন) যাতে দুই ধরনের প্রিন্ট আউট একই রকম দেখতে ও প্রেডিক্টেবল হয়,
 * এবং ভবিষ্যতে কেউ একটাতে পরিবর্তন আনলে অন্যটাও সহজে মিলিয়ে আপডেট করতে
 * পারে।
 */
export function PaymentReceipt({
  payment,
  orderNumber,
  customerName,
  customerPhone,
  branch,
  tenant,
}: PaymentReceiptProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div>
      <div className="mb-4 flex justify-end" data-print-hide>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("orders.printReceiptAction")}
        </button>
      </div>

      <div
        data-print-content
        className="mx-auto max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 print:max-w-none print:border-0 print:p-0"
      >
        <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-3">
            {tenant.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={tenant.name} className="h-12 w-12 rounded object-contain" />
            )}
            <div>
              <h1 className="text-lg font-semibold">{tenant.name}</h1>
              {branch && <p className="text-sm text-neutral-500">{branch.name}</p>}
              <p className="text-xs text-neutral-400">{branch?.address || tenant.address}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-brand-primary">{t("orders.receiptTitle")}</p>
            <p className="text-xs text-neutral-400">
              {t("orders.paymentDate")}: {formatDate(payment.paymentDate, locale)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase text-neutral-400">{t("orders.customer")}</p>
            <p className="font-medium">{customerName}</p>
            <p className="text-neutral-500">{customerPhone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase text-neutral-400">{t("orders.orderNumber")}</p>
            <p className="font-mono font-medium">{orderNumber}</p>
          </div>
        </div>

        <div className="mt-6 space-y-2 rounded-lg bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">{t("orders.paymentMethodLabel")}</span>
            <span className="font-medium">{t(METHOD_LABEL_KEYS[payment.paymentMethod])}</span>
          </div>
          {payment.referenceNumber && (
            <div className="flex justify-between">
              <span className="text-neutral-500">{t("orders.referenceNumber")}</span>
              <span className="font-mono">{payment.referenceNumber}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-emerald-700">
            <span>{t("customers.amount")}</span>
            <span>{formatTaka(payment.amount)}</span>
          </div>
        </div>

        {payment.notes && <p className="mt-3 text-xs text-neutral-500">{payment.notes}</p>}

        {tenant.footerMessage && (
          <p className="mt-6 border-t border-neutral-200 pt-3 text-center text-xs text-neutral-400">
            {tenant.footerMessage}
          </p>
        )}

        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-neutral-500">
          <div className="border-t border-neutral-400 pt-1">{t("orders.customerSignature")}</div>
          <div className="border-t border-neutral-400 pt-1">{t("orders.authoritySignature")}</div>
        </div>
      </div>
    </div>
  );
}
