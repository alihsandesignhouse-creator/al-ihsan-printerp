"use client";

import { useTranslations, useLocale } from "next-intl";
import { Printer } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { PortalTrackingResult } from "@/lib/types/portal";

interface PortalInvoiceViewProps {
  result: PortalTrackingResult;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * blueprint T-20: "ইনভয়েস দেখা ও ডাউনলোড"। "ডাউনলোড" এখানে ব্রাউজারের
 * নেটিভ Print → Save as PDF দিয়ে বাস্তবায়িত — ঠিক যেভাবে
 * components/tenant/orders/delivery-challan.tsx-এ ব্যবহৃত হয়েছে
 * (এই কোডবেসে PDF-সমতুল্য সবসময় window.print(), আলাদা কোনো PDF-জেনারেটর
 * dependency নেই)।
 */
export function PortalInvoiceView({ result }: PortalInvoiceViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { tenant, branch, order, items } = result;

  return (
    <div>
      <div className="mb-4 flex justify-end" data-print-hide>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("portal.downloadInvoice")}
        </button>
      </div>

      <div
        data-print-content
        className="mx-auto max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 print:max-w-none print:border-0 print:p-0"
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
            <p className="text-sm font-semibold text-brand-primary">{t("portal.invoiceTitle")}</p>
            <p className="font-mono text-sm">{order.orderNumber}</p>
            <p className="text-xs text-neutral-400">
              {t("orders.orderDate")}: {formatDate(order.createdAt, locale)}
            </p>
            <p className="text-xs text-neutral-400">
              {t("orders.deliveryDate")}: {formatDate(order.expectedDeliveryDate, locale)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase text-neutral-400">{t("orders.customer")}</p>
            <p className="font-medium">{order.customerName}</p>
            <p className="text-neutral-500">{order.customerPhone}</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs font-semibold uppercase text-neutral-500">
              <th className="py-2">{t("orders.itemName")}</th>
              <th className="py-2 text-right">{t("orders.quantity")}</th>
              <th className="py-2 text-right">{t("orders.unitPrice")}</th>
              <th className="py-2 text-right">{t("orders.lineTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100">
                <td className="py-2">
                  {item.itemName}
                  {item.description && <p className="text-xs text-neutral-400">{item.description}</p>}
                </td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatTaka(item.unitPrice)}</td>
                <td className="py-2 text-right font-medium">{formatTaka(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">{t("orders.subtotal")}</span>
            <span>{formatTaka(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">{t("orders.discount")}</span>
            <span>{formatTaka(order.discountAmount)}</span>
          </div>
          {order.adjustment !== 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-500">{t("orders.adjustment")}</span>
              <span>{formatTaka(order.adjustment)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold">
            <span>{t("orders.totalAmount")}</span>
            <span>{formatTaka(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">{t("orders.advanceAmount")}</span>
            <span>{formatTaka(order.advanceAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-status-danger">
            <span>{t("orders.dueAmount")}</span>
            <span>{formatTaka(order.dueAmount)}</span>
          </div>
        </div>

        {tenant.invoiceFooterMessage && (
          <p className="mt-6 border-t border-neutral-200 pt-3 text-center text-xs text-neutral-400">
            {tenant.invoiceFooterMessage}
          </p>
        )}
      </div>
    </div>
  );
}
