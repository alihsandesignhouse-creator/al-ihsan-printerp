"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, CreditCard, Printer, UserCog, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  subscribeToOrder,
  subscribeToOrderItems,
  subscribeToOrderPayments,
  getActiveStaffOptions,
  softDeleteOrder,
} from "@/lib/firebase/orders";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { OrderStatusBadge } from "@/components/tenant/orders/order-status-badge";
import { OrderStatusControl } from "@/components/tenant/orders/order-status-control";
import { PaymentModal } from "@/components/tenant/orders/payment-modal";
import { ReassignStaffModal } from "@/components/tenant/orders/reassign-staff-modal";
import { DeliveryChallan } from "@/components/tenant/orders/delivery-challan";
import { WhatsAppSendButton } from "@/components/tenant/orders/whatsapp-send-button";
import { OrderCostingSection } from "@/components/tenant/orders/order-costing-section";
import { computeEffectiveFeatures } from "@/lib/firebase/tenants";
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
import { formatTaka } from "@/lib/utils/calculations";
import type { Order, OrderItem, Payment, StaffOption } from "@/lib/types/order";
import type { Branch } from "@/lib/types/dashboard";
import type { Tenant } from "@/lib/types/tenant";

export default function OrderDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params.orderId;

  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const canManage = role === "tenant_admin" || role === "branch_manager";
  const handleFirestoreError = useFirestoreErrorHandler();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [tenantInfo, setTenantInfo] = useState<{ name: string; logoUrl: string; address: string } | null>(null);
  const [costingEnabled, setCostingEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(searchParams.get("action") === "payment");
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState(searchParams.get("action") === "print");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !orderId) return;
    const unsub = subscribeToOrder(tenantId, orderId, (data) => {
      setOrder(data);
      setIsLoading(false);
    }, handleFirestoreError(() => setIsLoading(false)));
    return () => unsub();
  }, [tenantId, orderId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !orderId) return;
    const unsub = subscribeToOrderItems(tenantId, orderId, setItems, handleFirestoreError());
    return () => unsub();
  }, [tenantId, orderId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !orderId) return;
    const unsub = subscribeToOrderPayments(tenantId, orderId, setPayments, handleFirestoreError());
    return () => unsub();
  }, [tenantId, orderId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    getDoc(doc(db, "tenants", tenantId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as Tenant;
        setTenantInfo({ name: data.name, logoUrl: data.logoUrl, address: data.address });
        setCostingEnabled(computeEffectiveFeatures(data.planId, data.featureOverrides, data.planFeatures).costingManagement);
        setWhatsappEnabled(computeEffectiveFeatures(data.planId, data.featureOverrides, data.planFeatures).whatsappNotifications);
      }
    });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !order?.branchId) return;
    getDoc(doc(db, "tenants", tenantId, "branches", order.branchId)).then((snap) => {
      if (snap.exists()) setBranch({ id: snap.id, ...snap.data() } as Branch);
    });
  }, [tenantId, order?.branchId]);

  useEffect(() => {
    if (!tenantId) return;
    getActiveStaffOptions(tenantId, "all").then(setStaffOptions).catch(() => setStaffOptions([]));
  }, [tenantId]);

  async function handleDelete() {
    if (!tenantId || !orderId || !user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await softDeleteOrder(tenantId, orderId, user.uid);
      router.push("/dashboard/orders");
    } catch {
      setDeleteError(t("orders.deleteFailed"));
      setIsDeleting(false);
    }
  }

  if (!tenantId) return null;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-300" aria-hidden="true" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-center text-sm text-neutral-400">{t("orders.notFoundMessage")}</div>
    );
  }

  if (showPrintView && tenantInfo) {
    return (
      <div className="p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setShowPrintView(false)}
          data-print-hide
          className="mb-3 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </button>
        <DeliveryChallan
          order={order}
          items={items}
          branch={branch}
          tenant={{ name: tenantInfo.name, logoUrl: tenantInfo.logoUrl, address: tenantInfo.address, footerMessage: "" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.push("/dashboard/orders")}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("common.back")}
      </button>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {order.isUrgent && <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />}
              <h1 className="font-mono text-base font-semibold text-neutral-900">{order.orderNumber}</h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {order.customerName} &middot; {order.customerPhone}
            </p>
          </div>
          <OrderStatusControl tenantId={tenantId} orderId={order.id} currentStatus={order.status} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            {t("orders.recordPayment")}
          </button>
          <button
            type="button"
            onClick={() => setShowPrintView(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            {t("orders.printChallanAction")}
          </button>
          {whatsappEnabled && tenantId && (
            <WhatsAppSendButton
              tenantId={tenantId}
              orderId={order.id}
              orderNumber={order.orderNumber}
              customerName={order.customerName}
              customerPhone={order.customerPhone}
              dueAmount={order.dueAmount}
            />
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setShowReassignModal(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <UserCog className="h-4 w-4" aria-hidden="true" />
              {t("orders.reassignStaff")}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-medium text-status-danger hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("common.delete")}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">{t("orders.itemsSection")}</h2>
        <div className="divide-y divide-neutral-100">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-neutral-900">{item.itemName}</p>
                {item.description && <p className="text-xs text-neutral-400">{item.description}</p>}
                {item.selectedAttributes && item.selectedAttributes.length > 0 && (
                  <p className="text-xs text-neutral-400">
                    {item.selectedAttributes.map((a) => `${a.groupName}: ${a.optionLabel}`).join(" · ")}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-neutral-600">
                  {item.quantity} × {formatTaka(item.unitPrice)}
                </p>
                <p className="font-mono font-medium">{formatTaka(item.lineTotal)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 border-t border-neutral-100 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">{t("orders.subtotal")}</span>
            <span>{formatTaka(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">{t("orders.discount")}</span>
            <span>{formatTaka(order.discountAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold">
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
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">{t("orders.paymentHistory")}</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("orders.noPayments")}</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{t(`orders.paymentMethod.${p.paymentMethod}`)}</p>
                  {p.referenceNumber && <p className="text-xs text-neutral-400">{p.referenceNumber}</p>}
                </div>
                <p className="font-mono font-medium text-emerald-600">{formatTaka(p.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {costingEnabled && user && (
        <OrderCostingSection
          tenantId={tenantId}
          userId={user.uid}
          userName={user.displayName ?? user.email ?? ""}
          order={{ id: order.id, orderNumber: order.orderNumber, branchId: order.branchId, totalAmount: order.totalAmount }}
          canEdit={canManage || (role === "commission_staff" && order.takenByStaffId === user.uid)}
          canManageSupplierLedger={canManage}
        />
      )}

      {order.notes && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-neutral-900">{t("orders.notes")}</h2>
          <p className="text-sm text-neutral-600">{order.notes}</p>
        </div>
      )}

      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        tenantId={tenantId}
        orderId={order.id}
        currentDue={order.dueAmount}
      />

      <ReassignStaffModal
        open={showReassignModal}
        onOpenChange={setShowReassignModal}
        tenantId={tenantId}
        orderId={order.id}
        staffOptions={staffOptions}
        currentStaffId={order.assignedStaffId}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders.confirmDeleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-xs text-status-danger">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-status-danger text-white hover:bg-status-danger/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
