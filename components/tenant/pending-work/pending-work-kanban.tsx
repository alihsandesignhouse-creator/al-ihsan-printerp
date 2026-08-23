"use client";

import { useTranslations, useLocale } from "next-intl";
import { AlertCircle, Clock, PackageX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusControl } from "@/components/tenant/orders/order-status-control";
import { formatTaka } from "@/lib/utils/calculations";
import { formatDateLocalized } from "@/lib/utils/format";
import type { Order, OrderStatus } from "@/lib/types/order";
import {
  isOverdue,
  isToday,
  daysOverdue,
  cardHighlightClass,
} from "./pending-work-utils";

type KanbanStatus = "pending" | "in_progress" | "ready";
const KANBAN_STATUSES: KanbanStatus[] = ["pending", "in_progress", "ready"];

const COLUMN_HEADER_CLASS: Record<KanbanStatus, string> = {
  pending: "border-b-2 border-blue-400 text-blue-700",
  in_progress: "border-b-2 border-amber-400 text-amber-700",
  ready: "border-b-2 border-emerald-400 text-emerald-700",
};

interface PendingWorkKanbanProps {
  tenantId: string;
  orders: Order[];
  isLoading: boolean;
  staffNames: Map<string, string>;
  onCardClick: (order: Order) => void;
}

export function PendingWorkKanban({
  tenantId,
  orders,
  isLoading,
  staffNames,
  onCardClick,
}: PendingWorkKanbanProps) {
  const t = useTranslations();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {KANBAN_STATUSES.map((s) => (
          <div key={s} className="space-y-2">
            <Skeleton className="h-8 rounded-lg" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const grouped = KANBAN_STATUSES.reduce<Record<KanbanStatus, Order[]>>(
    (acc, s) => ({ ...acc, [s]: [] }),
    { pending: [], in_progress: [], ready: [] }
  );

  for (const order of orders) {
    const s = order.status as OrderStatus;
    if (s === "pending" || s === "in_progress" || s === "ready") {
      grouped[s].push(order);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-16 text-center">
        <PackageX className="h-10 w-10 text-neutral-300" aria-hidden="true" />
        <p className="text-sm font-medium text-neutral-400">{t("pendingWork.noOrders")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 overflow-x-auto">
      {KANBAN_STATUSES.map((status) => {
        const col = grouped[status];
        return (
          <div key={status} className="flex flex-col gap-2 min-w-[220px]">
            {/* Column header */}
            <div
              className={`flex items-center justify-between rounded-t-lg bg-white px-3 py-2 text-sm font-semibold ${COLUMN_HEADER_CLASS[status]}`}
            >
              <span>
                {status === "pending" && t("pendingWork.kanban.pending")}
                {status === "in_progress" && t("pendingWork.kanban.inProgress")}
                {status === "ready" && t("pendingWork.kanban.ready")}
              </span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-600">
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {col.map((order) => (
                <KanbanCard
                  key={order.id}
                  tenantId={tenantId}
                  order={order}
                  staffNames={staffNames}
                  onClick={() => onCardClick(order)}
                />
              ))}
              {col.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 py-6 text-center text-xs text-neutral-400">
                  {t("pendingWork.noOrders")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
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

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-shadow hover:shadow-sm ${cardHighlightClass(order)}`}
    >
      {/* Order number + urgent */}
      <div className="flex items-center gap-1.5">
        {order.isUrgent && (
          <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" aria-hidden="true" />
        )}
        <span className="font-mono text-[11px] font-semibold text-brand-primary">
          {order.orderNumber}
        </span>
        {order.orderNumber.startsWith("OFFLINE-") && (
          <Clock className="h-3 w-3 text-neutral-400" />
        )}
      </div>

      {/* Customer */}
      <p className="text-xs font-semibold text-neutral-900 leading-tight">{order.customerName}</p>

      {/* Items */}
      {order.itemSummary && (
        <p className="line-clamp-2 text-[11px] text-neutral-500">{order.itemSummary}</p>
      )}

      {/* Date chip */}
      {(() => {
        const date = order.expectedDeliveryDate?.toDate?.();
        if (!date) return null;
        const dateStr = formatDateLocalized(date, locale, { day: "numeric", month: "short" });
        if (isOverdue(order)) {
          return (
            <span className="self-start rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
              {dateStr} · {daysOverdue(order)} {t("pendingWork.overdueBy")}
            </span>
          );
        }
        if (isToday(order)) {
          return (
            <span className="self-start rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              {t("pendingWork.today")}
            </span>
          );
        }
        return (
          <span className="self-start rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
            {dateStr}
          </span>
        );
      })()}

      {/* Footer: due + staff + status */}
      <div className="flex items-center justify-between gap-1 mt-0.5">
        <div className="flex flex-col gap-0.5">
          {order.dueAmount > 0 && (
            <span className="text-[11px] font-semibold text-status-danger">
              {formatTaka(order.dueAmount)}
            </span>
          )}
          <span className="text-[10px] text-neutral-400">
            {order.assignedStaffId
              ? staffNames.get(order.assignedStaffId) ?? "—"
              : t("pendingWork.unassigned")}
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <OrderStatusControl
            tenantId={tenantId}
            orderId={order.id}
            currentStatus={order.status}
          />
        </div>
      </div>
    </div>
  );
}
