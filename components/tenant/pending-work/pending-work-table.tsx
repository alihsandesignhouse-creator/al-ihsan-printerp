"use client";

import { useTranslations, useLocale } from "next-intl";
import { AlertCircle, Clock, PackageX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusControl } from "@/components/tenant/orders/order-status-control";
import { formatTaka } from "@/lib/utils/calculations";
import { formatDateLocalized } from "@/lib/utils/format";
import type { Order } from "@/lib/types/order";
import {
  isOverdue,
  isToday,
  daysOverdue,
  daysLeft,
  rowHighlightClass,
} from "./pending-work-utils";

interface PendingWorkTableProps {
  tenantId: string;
  orders: Order[];
  isLoading: boolean;
  staffNames: Map<string, string>;
  onRowClick: (order: Order) => void;
}

function DeliveryDateCell({ order }: { order: Order }) {
  const t = useTranslations();
  const locale = useLocale();
  const date = order.expectedDeliveryDate?.toDate?.();
  if (!date) return <span className="text-neutral-400">—</span>;

  const formatted = formatDateLocalized(date, locale, { day: "numeric", month: "short" });

  if (isOverdue(order)) {
    const n = daysOverdue(order);
    return (
      <div>
        <div className="font-medium text-status-danger">{formatted}</div>
        <div className="text-xs text-status-danger">
          {n} {t("pendingWork.overdueBy")}
        </div>
      </div>
    );
  }
  if (isToday(order)) {
    return (
      <div>
        <div className="font-medium text-amber-600">{formatted}</div>
        <div className="text-xs text-amber-500">{t("pendingWork.today")}</div>
      </div>
    );
  }
  const n = daysLeft(order);
  return (
    <div>
      <div className="text-neutral-700">{formatted}</div>
      {n <= 3 && (
        <div className="text-xs text-amber-500">
          {n} {t("pendingWork.daysLeft")}
        </div>
      )}
    </div>
  );
}

export function PendingWorkTable({
  tenantId,
  orders,
  isLoading,
  staffNames,
  onRowClick,
}: PendingWorkTableProps) {
  const t = useTranslations();

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-16 text-center">
        <PackageX className="h-10 w-10 text-neutral-300" aria-hidden="true" />
        <p className="text-sm font-medium text-neutral-400">{t("pendingWork.noOrders")}</p>
        <p className="text-xs text-neutral-300">{t("pendingWork.noOrdersHint")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("pendingWork.column.orderNo")}</th>
              <th className="px-4 py-2.5">{t("pendingWork.column.customer")}</th>
              <th className="px-4 py-2.5 max-w-[180px]">{t("pendingWork.column.items")}</th>
              <th className="px-4 py-2.5">{t("pendingWork.column.deliveryDate")}</th>
              <th className="px-4 py-2.5">{t("pendingWork.column.staff")}</th>
              <th className="px-4 py-2.5">{t("pendingWork.column.due")}</th>
              <th className="px-4 py-2.5">{t("pendingWork.column.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((order) => (
              <tr
                key={order.id}
                onClick={() => onRowClick(order)}
                className={`cursor-pointer transition-colors ${rowHighlightClass(order)}`}
              >
                {/* Order number */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-brand-primary">
                      {order.orderNumber}
                    </span>
                    {order.orderNumber.startsWith("OFFLINE-") && (
                      <Clock
                        className="h-3 w-3 text-neutral-400"
                        aria-label={t("common.pendingSync")}
                      />
                    )}
                  </div>
                </td>

                {/* Customer */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {order.isUrgent && (
                      <AlertCircle
                        className="h-3.5 w-3.5 shrink-0 text-amber-500"
                        aria-label={t("pendingWork.urgent")}
                      />
                    )}
                    <span className="font-medium text-neutral-900">{order.customerName}</span>
                  </div>
                  <p className="text-xs text-neutral-400">{order.customerPhone}</p>
                </td>

                {/* Items */}
                <td className="max-w-[180px] truncate px-4 py-3 text-xs text-neutral-500">
                  {order.itemSummary}
                </td>

                {/* Delivery date */}
                <td className="px-4 py-3">
                  <DeliveryDateCell order={order} />
                </td>

                {/* Staff */}
                <td className="px-4 py-3 text-xs text-neutral-600">
                  {order.assignedStaffId
                    ? (staffNames.get(order.assignedStaffId) ?? "—")
                    : <span className="text-neutral-400 italic">{t("pendingWork.unassigned")}</span>}
                </td>

                {/* Due amount */}
                <td className="px-4 py-3 font-mono text-xs">
                  {order.dueAmount > 0 ? (
                    <span className="font-semibold text-status-danger">{formatTaka(order.dueAmount)}</span>
                  ) : (
                    <span className="text-neutral-400">{formatTaka(0)}</span>
                  )}
                </td>

                {/* Status — stop propagation so row click doesn't fire */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <OrderStatusControl
                    tenantId={tenantId}
                    orderId={order.id}
                    currentStatus={order.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
