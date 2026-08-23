"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  ExternalLink,
  UserCog,
  AlertCircle,
  Clock,
  Phone,
  CalendarClock,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrderStatusControl } from "@/components/tenant/orders/order-status-control";
import { ReassignStaffModal } from "@/components/tenant/orders/reassign-staff-modal";
import { subscribeToOrder, getActiveStaffOptions } from "@/lib/firebase/orders";
import { formatDateLocalized } from "@/lib/utils/format";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { formatTaka } from "@/lib/utils/calculations";
import type { Order, StaffOption } from "@/lib/types/order";
import { isOverdue, isToday, daysOverdue } from "./pending-work-utils";

interface OrderDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  orderId: string | null;
  canManage: boolean; // tenant_admin or branch_manager
}

export function OrderDetailModal({
  open,
  onOpenChange,
  tenantId,
  orderId,
  canManage,
}: OrderDetailModalProps) {
  const t = useTranslations();
  const locale = useLocale();
  const handleFirestoreError = useFirestoreErrorHandler();
  const [order, setOrder] = useState<Order | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [showReassign, setShowReassign] = useState(false);

  // Live subscription on the selected order for real-time status/due updates
  useEffect(() => {
    if (!open || !orderId) {
      setOrder(null);
      return;
    }
    const unsub = subscribeToOrder(
      tenantId,
      orderId,
      (o) => setOrder(o),
      handleFirestoreError(() => setOrder(null))
    );
    return () => unsub();
  }, [tenantId, orderId, open, handleFirestoreError]);

  // Fetch staff list for reassign (only when canManage)
  useEffect(() => {
    if (!open || !canManage || !tenantId) return;
    getActiveStaffOptions(tenantId, "all")
      .then(setStaffOptions)
      .catch(() => setStaffOptions([]));
  }, [open, canManage, tenantId]);

  if (!order && open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Clock className="h-6 w-6 animate-spin text-neutral-400" aria-hidden="true" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!order) return null;

  const deliveryDate = order.expectedDeliveryDate?.toDate?.();
  const deliveryStr = deliveryDate
    ? formatDateLocalized(deliveryDate, locale, {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const createdDate = order.createdAt?.toDate?.();
  const createdStr = createdDate ? formatDateLocalized(createdDate, locale) : "—";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {order.isUrgent && (
                    <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  )}
                  <span className="font-mono text-base">{order.orderNumber}</span>
                </DialogTitle>

                {isOverdue(order) && (
                  <p className="mt-1 text-xs font-medium text-status-danger">
                    {t("pendingWork.overdue")} · {daysOverdue(order)} {t("pendingWork.overdueBy")}
                  </p>
                )}
                {isToday(order) && !isOverdue(order) && (
                  <p className="mt-1 text-xs font-medium text-amber-600">{t("pendingWork.today")}</p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status control */}
            <div className="flex items-center gap-3">
              <OrderStatusControl
                tenantId={tenantId}
                orderId={order.id}
                currentStatus={order.status}
                onChanged={() => {/* live-updating via subscription */}}
              />
            </div>

            {/* Customer info */}
            <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t("pendingWork.detailModal.customerInfo")}
              </h3>
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                <span className="text-sm font-medium text-neutral-900">{order.customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                <span className="text-sm text-neutral-600">{order.customerPhone}</span>
              </div>
            </section>

            {/* Items */}
            {order.itemSummary && (
              <p className="text-sm text-neutral-700 leading-relaxed">{order.itemSummary}</p>
            )}

            {/* Delivery + meta */}
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center gap-2 text-neutral-600">
                <CalendarClock className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                <span className="font-medium">{t("pendingWork.detailModal.delivery")}:</span>
                <span
                  className={
                    isOverdue(order)
                      ? "font-semibold text-status-danger"
                      : isToday(order)
                      ? "font-semibold text-amber-600"
                      : ""
                  }
                >
                  {deliveryStr}
                </span>
              </div>
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                <Clock className="h-3 w-3 text-neutral-300" aria-hidden="true" />
                <span>{t("orders.orderDate")}: {createdStr}</span>
              </div>
            </div>

            {/* Financials */}
            <section className="rounded-lg border border-neutral-200 p-3 space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t("pendingWork.detailModal.financials")}
              </h3>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">{t("pendingWork.detailModal.totalAmount")}</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {formatTaka(order.totalAmount)}
                </span>
              </div>
              {order.advanceAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{t("pendingWork.detailModal.advance")}</span>
                  <span className="font-mono text-neutral-700">
                    {formatTaka(order.advanceAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-100 pt-1.5 text-sm">
                <span className="font-medium text-neutral-700">
                  {t("pendingWork.detailModal.due")}
                </span>
                <span
                  className={`font-mono font-bold ${
                    order.dueAmount > 0 ? "text-status-danger" : "text-neutral-400"
                  }`}
                >
                  {formatTaka(order.dueAmount)}
                </span>
              </div>
            </section>

            {/* Notes */}
            {order.notes && (
              <div className="rounded-lg bg-neutral-50 p-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {t("pendingWork.detailModal.notes")}
                </h3>
                <p className="text-sm text-neutral-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-4">
            <div className="flex items-center gap-2">
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReassign(true)}
                  className="gap-1.5"
                >
                  <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("pendingWork.detailModal.reassign")}
                </Button>
              )}
            </div>
            <Link
              href={`/dashboard/orders/${order.id}`}
              className="flex items-center gap-1.5 rounded-lg border border-brand-primary px-3 py-2 text-xs font-medium text-brand-primary hover:bg-brand-primary/5"
              onClick={() => onOpenChange(false)}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {t("pendingWork.detailModal.viewFull")}
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign staff modal (separate Dialog, mounted outside above) */}
      {canManage && (
        <ReassignStaffModal
          open={showReassign}
          onOpenChange={setShowReassign}
          tenantId={tenantId}
          orderId={order.id}
          staffOptions={staffOptions}
          currentStaffId={order.assignedStaffId}
          onReassigned={() => setShowReassign(false)}
        />
      )}
    </>
  );
}
