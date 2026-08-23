"use client";

import { useTranslations, useLocale } from "next-intl";
import { AlertCircle, Clock, PackageX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusControl } from "@/components/tenant/orders/order-status-control";
import { formatTaka } from "@/lib/utils/calculations";
import type { Order } from "@/lib/types/order";
import { formatDateLocalized } from "@/lib/utils/format";
import {
  isOverdue,
  isToday,
  daysOverdue,
  daysLeft,
  cardHighlightClass,
} from "./pending-work-utils";

interface PendingWorkCardsProps {
  tenantId: string;
  orders: Order[];
  isLoading: boolean;
  staffNames: Map<string, string>;
  onCardClick: (order: Order) => void;
}

export function PendingWorkCards({
  tenantId,
  orders,
  isLoading,
  staffNames,
  onCardClick,
}: PendingWorkCardsProps) {
  const t = useTranslations();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          tenantId={tenantId}
          order={order}
          staffNames={staffNames}
          onClick={() => onCardClick(order)}
        />
      ))}
    </div>
  );
}

function OrderCard({
  tenantId,
  order,
  staffNames,
  onClick,
}: {
  tenantId: string;
  order: Order;
  staffNames: Map<string, string>;
  onClick: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const date = order.expectedDeliveryDate?.toDate?.();

  const dateStr = date
    ? formatDateLocalized(date, locale, { day: "numeric", month: "short" })
    : "—";

  let dateChipClass = "bg-neutral-100 text-neutral-600";
  let dateLabel = dateStr;

  if (isOverdue(order)) {
    const n = daysOverdue(order);
    dateChipClass = "bg-red-100 text-red-700";
    dateLabel = `${dateStr} · ${n} ${t("pendingWork.overdueBy")}`;
  } else if (isToday(order)) {
    dateChipClass = "bg-amber-100 text-amber-700";
    dateLabel = `${dateStr} · ${t("pendingWork.today")}`;
  } else if (date) {
    const n = daysLeft(order);
    if (n <= 3) {
      dateChipClass = "bg-amber-50 text-amber-600";
      dateLabel = `${dateStr} · ${n} ${t("pendingWork.daysLeft")}`;
    }
  }

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-sm ${cardHighlightClass(order)}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            {order.isUrgent && (
              <AlertCircle
                className="h-3.5 w-3.5 text-amber-500 shrink-0"
                aria-label={t("pendingWork.urgent")}
              />
            )}
            <span className="font-mono text-xs font-semibold text-brand-primary">
              {order.orderNumber}
            </span>
            {order.orderNumber.startsWith("OFFLINE-") && (
              <Clock className="h-3 w-3 text-neutral-400" />
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-neutral-900 leading-tight">
            {order.customerName}
          </p>
          <p className="text-xs text-neutral-400">{order.customerPhone}</p>
        </div>

        {/* Status dropdown — stop propagation */}
        <div onClick={(e) => e.stopPropagation()}>
          <OrderStatusControl
            tenantId={tenantId}
            orderId={order.id}
            currentStatus={order.status}
          />
        </div>
      </div>

      {/* Items summary */}
      {order.itemSummary && (
        <p className="line-clamp-2 text-xs text-neutral-500">{order.itemSummary}</p>
      )}

      {/* Footer chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-auto">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${dateChipClass}`}>
          {dateLabel}
        </span>

        {order.dueAmount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            {formatTaka(order.dueAmount)}
          </span>
        )}

        {order.assignedStaffId ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
            {staffNames.get(order.assignedStaffId) ?? "—"}
          </span>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] italic text-neutral-400">
            {t("pendingWork.unassigned")}
          </span>
        )}
      </div>
    </div>
  );
}
