"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { formatDateLocalized } from "@/lib/utils/format";
import { PackageX } from "lucide-react";
import { OrderStatusBadge } from "@/components/tenant/orders/order-status-badge";
import { formatTaka } from "@/lib/utils/calculations";
import type { Order } from "@/lib/types/customer";

interface CustomerOrderHistoryTabProps {
  orders: Order[];
  isLoading: boolean;
}

function formatDate(ts: Order["createdAt"], locale: string): string {
  const date = ts?.toDate?.();
  if (!date) return "—";
  return formatDateLocalized(date, locale);
}

export function CustomerOrderHistoryTab({ orders, isLoading }: CustomerOrderHistoryTabProps) {
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

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <PackageX className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("customers.noOrdersFound")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("orders.orderNumber")}</th>
              <th className="px-4 py-2.5">{t("customers.orderDate")}</th>
              <th className="px-4 py-2.5">{t("orders.items")}</th>
              <th className="px-4 py-2.5">{t("orders.statusColumn")}</th>
              <th className="px-4 py-2.5 text-right">{t("orders.totalAmount")}</th>
              <th className="px-4 py-2.5 text-right">{t("orders.dueAmount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="font-medium text-neutral-900 hover:text-brand-primary hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-600">{formatDate(order.createdAt, locale)}</td>
                <td className="px-4 py-3 text-neutral-600">{order.itemSummary || "—"}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-neutral-900">
                  {formatTaka(order.totalAmount)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {order.dueAmount > 0 ? (
                    <span className="font-semibold text-status-danger">{formatTaka(order.dueAmount)}</span>
                  ) : (
                    <span className="text-neutral-400">{formatTaka(0)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
