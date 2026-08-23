"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDateLocalized } from "@/lib/utils/format";
import { Printer } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import { TrackingQrCode } from "@/components/shared/tracking-qr-code";
import type { Order, OrderItem } from "@/lib/types/order";
import type { Branch } from "@/lib/types/dashboard";

interface TenantBrandInfo {
  name: string;
  logoUrl: string;
  address: string;
  footerMessage: string;
}

interface DeliveryChallanProps {
  order: Order;
  items: OrderItem[];
  branch: Branch | null;
  tenant: TenantBrandInfo;
}

function formatDate(value: { toDate?: () => Date } | null | undefined, locale: string): string {
  const date = value?.toDate?.();
  if (!date) return "";
  return formatDateLocalized(date, locale, { day: "numeric", month: "long", year: "numeric" });
}

export function DeliveryChallan({ order, items, branch, tenant }: DeliveryChallanProps) {
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
          {t("orders.printChallanAction")}
        </button>
      </div>

      <div data-print-content className="mx-auto max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 print:max-w-none print:border-0 print:p-0">
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
            <p className="text-sm font-semibold text-brand-primary">{t("orders.challanTitle")}</p>
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

        {/* AUDIT-REPORT-5 Issue #4 fix: on narrow (mobile) screens this table
            is shown as an on-screen preview (not just via window.print()),
            so it needs its own horizontal scroll container — print:overflow-visible
            ensures the wrapper never clips/scrollbars the actual printed page. */}
        <div className="overflow-x-auto print:overflow-visible">
        <table className="mt-4 w-full min-w-[480px] text-sm">
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
                  {item.selectedAttributes && item.selectedAttributes.length > 0 && (
                    <p className="text-xs text-neutral-400">
                      {item.selectedAttributes.map((a) => `${a.groupName}: ${a.optionLabel}`).join(" · ")}
                    </p>
                  )}
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

        {tenant.footerMessage && (
          <p className="mt-6 border-t border-neutral-200 pt-3 text-center text-xs text-neutral-400">
            {tenant.footerMessage}
          </p>
        )}

        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-neutral-500">
          <div className="border-t border-neutral-400 pt-1">{t("orders.customerSignature")}</div>
          <div className="border-t border-neutral-400 pt-1">{t("orders.authoritySignature")}</div>
        </div>

        <div className="mt-6 flex justify-center">
          <TrackingQrCode tenantId={order.tenantId} orderNumber={order.orderNumber} />
        </div>
      </div>
    </div>
  );
}
