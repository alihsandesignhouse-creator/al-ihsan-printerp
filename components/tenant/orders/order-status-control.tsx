"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateOrderStatus } from "@/lib/firebase/orders";
import type { OrderStatus } from "@/lib/types/order";

const STATUS_OPTIONS: OrderStatus[] = ["pending", "in_progress", "ready", "delivered", "cancelled"];

const SELECT_CLASSES: Record<OrderStatus, string> = {
  pending: "border-blue-200 bg-blue-50 text-blue-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  delivered: "border-green-200 bg-green-50 text-green-800",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

interface OrderStatusControlProps {
  tenantId: string;
  orderId: string;
  currentStatus: OrderStatus;
  onChanged?: (status: OrderStatus) => void;
}

export function OrderStatusControl({
  tenantId,
  orderId,
  currentStatus,
  onChanged,
}: OrderStatusControlProps) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [pendingCancel, setPendingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyStatus(status: OrderStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateOrderStatus(tenantId, orderId, status);
        onChanged?.(status);
      } catch {
        setError(t("orders.statusUpdateFailed"));
      }
    });
  }

  function handleChange(value: string) {
    const status = value as OrderStatus;
    if (status === currentStatus) return;
    if (status === "cancelled") {
      setPendingCancel(true);
      return;
    }
    applyStatus(status);
  }

  return (
    <>
      <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
        <select
          value={currentStatus}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.value)}
          aria-label={t("orders.changeStatus")}
          className={`h-8 appearance-none rounded-md border pl-2 pr-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-60 ${SELECT_CLASSES[currentStatus]}`}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {t(`orders.status.${status}`)}
            </option>
          ))}
        </select>
        {isPending ? (
          <Loader2 className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5" aria-hidden="true" />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}

      <AlertDialog open={pendingCancel} onOpenChange={setPendingCancel}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.confirmCancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders.confirmCancelDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-status-danger text-white hover:bg-status-danger/90"
              onClick={() => {
                setPendingCancel(false);
                applyStatus("cancelled");
              }}
            >
              {t("orders.confirmCancelAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
