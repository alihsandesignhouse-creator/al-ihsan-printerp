"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Link2, Pencil, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  subscribeCustomer,
  subscribeCustomerOrders,
  subscribeCustomerPayments,
  aggregateCustomerFinancials,
} from "@/lib/firebase/customers";
import { subscribeSupplier } from "@/lib/firebase/suppliers";
import { unlinkCustomerSupplier } from "@/lib/firebase/customer-supplier-link";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { CustomerFinancialSummaryCards } from "@/components/tenant/customers/customer-financial-summary-cards";
import { CustomerOrderHistoryTab } from "@/components/tenant/customers/customer-order-history-tab";
import { CustomerPaymentLedgerTab } from "@/components/tenant/customers/customer-payment-ledger-tab";
import { CustomerTrendTab } from "@/components/tenant/customers/customer-trend-tab";
import { CustomerFormDialog } from "@/components/tenant/customers/customer-form-dialog";
import { DeleteCustomerDialog } from "@/components/tenant/customers/delete-customer-dialog";
import { LinkSupplierDialog } from "@/components/tenant/customers/link-supplier-dialog";
import { LinkedProfileBanner } from "@/components/shared/linked-profile-banner";
import { PaymentReceipt } from "@/components/tenant/customers/payment-receipt";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { formatDateLocalized } from "@/lib/utils/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EMPTY_CUSTOMER_FINANCIALS } from "@/lib/types/customer";
import type { Customer, Order, Payment } from "@/lib/types/customer";
import type { Branch } from "@/lib/types/dashboard";
import type { Supplier } from "@/lib/types/supplier";

export default function CustomerProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const isTenantAdmin = role === "tenant_admin";
  const canManage = isTenantAdmin || role === "branch_manager";

  // Non-admin roles only ever see their own branch's orders/payments for this
  // customer — see the identical note in dashboard/customers/page.tsx.
  // Intentionally NOT using useEffectiveBranchId() here: this page has no
  // branch-filter dropdown of its own, so tenant_admin always sees the
  // customer's full cross-branch history regardless of whatever branch is
  // selected on the list page.
  const effectiveBranchId = isTenantAdmin ? "all" : (user?.claims.branchId ?? "all");
  const handleFirestoreError = useFirestoreErrorHandler();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [hasAdvancedReports, setHasAdvancedReports] = useState(false);
  const [hasDataExportFeature, setHasDataExportFeature] = useState(false);
  const [hasSupplierManagement, setHasSupplierManagement] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<{ name: string; logoUrl: string; address: string } | null>(null);

  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkedSupplier, setLinkedSupplier] = useState<Supplier | null>(null);
  const [showReceiptFor, setShowReceiptFor] = useState<Payment | null>(null);
  const [receiptBranch, setReceiptBranch] = useState<Branch | null>(null);

  useEffect(() => {
    if (!tenantId || !params.customerId) return;
    setIsLoadingCustomer(true);
    const unsub = subscribeCustomer(
      tenantId,
      params.customerId,
      (data) => {
        setCustomer(data);
        setIsLoadingCustomer(false);
      },
      handleFirestoreError(() => setIsLoadingCustomer(false))
    );
    return () => unsub();
  }, [tenantId, params.customerId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !params.customerId) return;
    setIsLoadingOrders(true);
    const unsub = subscribeCustomerOrders(
      tenantId,
      params.customerId,
      effectiveBranchId,
      (data) => {
        setOrders(data);
        setIsLoadingOrders(false);
      },
      handleFirestoreError(() => setIsLoadingOrders(false))
    );
    return () => unsub();
  }, [tenantId, params.customerId, effectiveBranchId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !params.customerId) return;
    setIsLoadingPayments(true);
    const unsub = subscribeCustomerPayments(
      tenantId,
      params.customerId,
      effectiveBranchId,
      (data) => {
        setPayments(data);
        setIsLoadingPayments(false);
      },
      handleFirestoreError(() => setIsLoadingPayments(false))
    );
    return () => unsub();
  }, [tenantId, params.customerId, effectiveBranchId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (tenant) => {
        if (!tenant) return;
        const features = computeEffectiveFeatures(tenant.planId, tenant.featureOverrides, tenant.planFeatures);
        setHasAdvancedReports(features.advancedReports);
        setHasDataExportFeature(features.dataExport);
        setHasSupplierManagement(features.supplierManagement);
        setTenantInfo({ name: tenant.name, logoUrl: tenant.logoUrl, address: tenant.address });
      },
      handleFirestoreError()
    );
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  // Payment receipt print view: each payment carries its own branchId (a
  // customer can have payments recorded across multiple branches), so the
  // branch is looked up fresh whenever a different payment's receipt is
  // opened — same one-off getDoc pattern as orders/[orderId]/page.tsx.
  useEffect(() => {
    if (!tenantId || !showReceiptFor) {
      setReceiptBranch(null);
      return;
    }
    getDoc(doc(db, "tenants", tenantId, "branches", showReceiptFor.branchId)).then((snap) => {
      setReceiptBranch(snap.exists() ? ({ id: snap.id, ...snap.data() } as Branch) : null);
    });
  }, [tenantId, showReceiptFor]);

  // যদি এই কাস্টমার একজন সাপ্লায়ারের সাথেও লিংক করা থাকে, তার বকেয়া
  // (currentDue) লাইভ subscribe করা হয় — LinkedProfileBanner-এর নিট
  // হিসাবের জন্য (১৭ আগস্ট ২০২৬)।
  useEffect(() => {
    if (!tenantId || !customer?.linkedSupplierId) {
      setLinkedSupplier(null);
      return;
    }
    const unsub = subscribeSupplier(tenantId, customer.linkedSupplierId, setLinkedSupplier, handleFirestoreError());
    return () => unsub();
  }, [tenantId, customer?.linkedSupplierId, handleFirestoreError]);

  async function handleUnlink() {
    if (!tenantId || !customer?.linkedSupplierId) return;
    await unlinkCustomerSupplier(tenantId, customer.id, customer.linkedSupplierId);
  }

  const financials = useMemo(() => {
    if (!params.customerId) return EMPTY_CUSTOMER_FINANCIALS;
    return aggregateCustomerFinancials(orders).get(params.customerId) ?? EMPTY_CUSTOMER_FINANCIALS;
  }, [orders, params.customerId]);

  const orderNumberByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) map.set(order.id, order.orderNumber);
    return map;
  }, [orders]);

  const paymentExportRows = useMemo(
    () =>
      payments.map((payment) => [
        payment.paymentDate?.toDate?.() ? formatDateLocalized(payment.paymentDate.toDate(), locale) : "",
        orderNumberByOrderId.get(payment.orderId) ?? payment.orderId,
        t(`orders.paymentMethod.${payment.paymentMethod}`),
        payment.amount,
      ]),
    [payments, orderNumberByOrderId, t, locale]
  );

  function handleDeleted() {
    router.push("/dashboard/customers");
  }

  if (!tenantId) return null;

  if (showReceiptFor && tenantInfo) {
    return (
      <div className="p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setShowReceiptFor(null)}
          data-print-hide
          className="mb-3 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </button>
        <PaymentReceipt
          payment={showReceiptFor}
          orderNumber={orderNumberByOrderId.get(showReceiptFor.orderId) ?? showReceiptFor.orderId}
          customerName={customer?.name ?? ""}
          customerPhone={customer?.phone ?? ""}
          branch={receiptBranch}
          tenant={{ name: tenantInfo.name, logoUrl: tenantInfo.logoUrl, address: tenantInfo.address, footerMessage: "" }}
        />
      </div>
    );
  }

  if (!isLoadingCustomer && !customer) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/customers")}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </button>
        <p className="text-sm text-neutral-400">{t("customers.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.push("/dashboard/customers")}
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("customers.pageTitle")}
      </button>

      {isLoadingCustomer || !customer ? (
        <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">{customer.name}</h1>
              <p className="mt-1 text-sm text-neutral-500">{customer.phone}</p>
              {customer.companyName && <p className="mt-0.5 text-sm text-neutral-500">{customer.companyName}</p>}
              {customer.email && <p className="mt-0.5 text-xs text-neutral-400">{customer.email}</p>}
              {customer.address && <p className="mt-0.5 text-xs text-neutral-400">{customer.address}</p>}
            </div>
            {canManage && (
              <div className="flex shrink-0 gap-2">
                {hasSupplierManagement && !customer.linkedSupplierId && (
                  <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    {t("customerSupplierLink.linkToSupplierAction")}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {t("common.edit")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-status-danger text-status-danger hover:bg-red-50"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t("common.delete")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {customer?.linkedSupplierId && (
        <div className="space-y-3">
          <LinkedProfileBanner
            otherRole="supplier"
            otherProfileHref={`/dashboard/suppliers/${customer.linkedSupplierId}`}
            otherProfileName={customer.linkedSupplierName ?? ""}
            customerDue={financials.totalDue}
            supplierDue={linkedSupplier?.currentDue ?? 0}
            canManage={canManage}
            onUnlink={handleUnlink}
          />
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => router.push(`/dashboard/orders/new?customerId=${customer.id}`)}>
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                {t("customerSupplierLink.sellAction")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/dashboard/suppliers/${customer.linkedSupplierId}/purchase`)}
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                {t("customerSupplierLink.purchaseAction")}
              </Button>
            </div>
          )}
        </div>
      )}

      <CustomerFinancialSummaryCards financials={financials} isLoading={isLoadingOrders} />

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t("customers.tabOrders")}</TabsTrigger>
          <TabsTrigger value="payments">{t("customers.tabPayments")}</TabsTrigger>
          <TabsTrigger value="trend">{t("customers.tabTrend")}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <CustomerOrderHistoryTab orders={orders} isLoading={isLoadingOrders} />
        </TabsContent>

        <TabsContent value="payments">
          <div className="mb-2 flex justify-end">
            <CsvExportButton
              hasDataExportFeature={hasDataExportFeature}
              filenamePrefix={`al-ihsan-printerp-customer-payments-${(customer?.name ?? params.customerId).replace(/[^\w-]+/g, "-")}`}
              headers={[t("customers.paymentDate"), t("orders.orderNumber"), t("orders.paymentMethodLabel"), t("customers.amount")]}
              rows={paymentExportRows}
            />
          </div>
          <CustomerPaymentLedgerTab
            payments={payments}
            orderNumberByOrderId={orderNumberByOrderId}
            isLoading={isLoadingPayments}
            onPrintReceipt={setShowReceiptFor}
          />
        </TabsContent>

        <TabsContent value="trend">
          <CustomerTrendTab orders={orders} isLoading={isLoadingOrders} hasAdvancedReports={hasAdvancedReports} />
        </TabsContent>
      </Tabs>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} tenantId={tenantId} editingCustomer={customer} />

      <DeleteCustomerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tenantId={tenantId}
        userId={user?.uid ?? ""}
        customer={customer}
        onDeleted={handleDeleted}
      />

      {customer && (
        <LinkSupplierDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          tenantId={tenantId}
          branchId={effectiveBranchId}
          customer={{ id: customer.id, name: customer.name }}
        />
      )}
    </div>
  );
}
