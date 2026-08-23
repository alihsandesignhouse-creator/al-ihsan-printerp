"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Banknote, Link2, Pencil, ShoppingCart, ShoppingBag, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeSupplier, subscribeSupplierTransactions, linkCostingToSupplierLedger } from "@/lib/firebase/suppliers";
import { subscribeCostingsBySupplier } from "@/lib/firebase/order-costing";
import { subscribeCustomerOrders, aggregateCustomerFinancials } from "@/lib/firebase/customers";
import { unlinkCustomerSupplier, createLinkedCustomerFromSupplier } from "@/lib/firebase/customer-supplier-link";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { SupplierLedgerHistory } from "@/components/tenant/suppliers/supplier-ledger-history";
import { SupplierCostingPurchases } from "@/components/tenant/suppliers/supplier-costing-purchases";
import { SupplierTransactionModal } from "@/components/tenant/suppliers/supplier-transaction-modal";
import { SupplierFormDialog } from "@/components/tenant/suppliers/supplier-form";
import { LinkCustomerDialog } from "@/components/tenant/suppliers/link-customer-dialog";
import { LinkedProfileBanner } from "@/components/shared/linked-profile-banner";
import { Button } from "@/components/ui/button";
import { formatTaka } from "@/lib/utils/calculations";
import { EMPTY_CUSTOMER_FINANCIALS } from "@/lib/types/customer";
import type { Branch } from "@/lib/types/dashboard";
import type { Supplier, SupplierTransaction, SupplierTransactionType } from "@/lib/types/supplier";
import type { OrderCosting } from "@/lib/types/order-costing";
import type { Order } from "@/lib/types/customer";

export default function SupplierDetailPage() {
  const t = useTranslations();
  const params = useParams<{ supplierId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const canManage = role === "tenant_admin" || role === "branch_manager";
  const isTenantAdmin = role === "tenant_admin";
  // subscribeCustomerOrders branch-scoping নিয়ম (lib/firebase/customers.ts):
  // tenant_admin ছাড়া অন্য কারো জন্য "all" পাস করলে পুরো query security
  // rules-এ reject হয় — তাই branch_manager-এর নিজের branchId ব্যবহার করা হয়।
  const effectiveBranchId = isTenantAdmin ? "all" : (user?.claims.branchId ?? "all");
  const handleFirestoreError = useFirestoreErrorHandler();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [costings, setCostings] = useState<OrderCosting[]>([]);
  const [isLoadingSupplier, setIsLoadingSupplier] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [isLoadingCostings, setIsLoadingCostings] = useState(true);
  const [linkingOrderId, setLinkingOrderId] = useState<string | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const [txOpen, setTxOpen] = useState(false);
  const [txType, setTxType] = useState<SupplierTransactionType>("purchase");
  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const [linkedCustomerOrders, setLinkedCustomerOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !params.supplierId) return;
    setIsLoadingSupplier(true);
    const unsub = subscribeSupplier(
      tenantId,
      params.supplierId,
      (data) => {
        setSupplier(data);
        setIsLoadingSupplier(false);
      },
      handleFirestoreError(() => setIsLoadingSupplier(false))
    );
    return () => unsub();
  }, [tenantId, params.supplierId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !params.supplierId) return;
    setIsLoadingTx(true);
    const unsub = subscribeSupplierTransactions(
      tenantId,
      params.supplierId,
      (data) => {
        setTransactions(data);
        setIsLoadingTx(false);
      },
      handleFirestoreError(() => setIsLoadingTx(false))
    );
    return () => unsub();
  }, [tenantId, params.supplierId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !params.supplierId) return;
    setIsLoadingCostings(true);
    const unsub = subscribeCostingsBySupplier(
      tenantId,
      params.supplierId,
      (data) => {
        setCostings(data);
        setIsLoadingCostings(false);
      },
      handleFirestoreError(() => setIsLoadingCostings(false))
    );
    return () => unsub();
  }, [tenantId, params.supplierId, handleFirestoreError]);

  function openTransaction(type: SupplierTransactionType) {
    setTxType(type);
    setTxOpen(true);
  }

  // যদি এই সাপ্লায়ার একজন কাস্টমারের সাথেও লিংক করা থাকে, (বকেয়া হিসাবের
  // জন্য) তার সব branch-এর অর্ডার লাইভ subscribe করা হয় — নাম/ID তো সরাসরি
  // supplier.linkedCustomerId/linkedCustomerName-এই আছে, তাই আলাদা কাস্টমার
  // ডকুমেন্ট subscribe করার দরকার নেই — LinkedProfileBanner-এর নিট হিসাবের
  // জন্য শুধু totalDue লাগবে (১৭ আগস্ট ২০২৬)।
  useEffect(() => {
    if (!tenantId || !supplier?.linkedCustomerId) {
      setLinkedCustomerOrders([]);
      return;
    }
    const unsub = subscribeCustomerOrders(
      tenantId,
      supplier.linkedCustomerId,
      effectiveBranchId,
      setLinkedCustomerOrders,
      handleFirestoreError()
    );
    return () => unsub();
  }, [tenantId, supplier?.linkedCustomerId, effectiveBranchId, handleFirestoreError]);

  const linkedCustomerDue = supplier?.linkedCustomerId
    ? (aggregateCustomerFinancials(linkedCustomerOrders).get(supplier.linkedCustomerId)?.totalDue ??
      EMPTY_CUSTOMER_FINANCIALS.totalDue)
    : 0;

  async function handleUnlink() {
    if (!tenantId || !supplier?.linkedCustomerId) return;
    await unlinkCustomerSupplier(tenantId, supplier.linkedCustomerId, supplier.id);
  }

  // ধাপ ৫ (১৭ আগস্ট ২০২৬) — "কাস্টমার বানান" বাটন। বিদ্যমান কাস্টমার
  // বেছে লিংক করার (LinkCustomerDialog) বিপরীতে, এটা সরাসরি সাপ্লায়ারের
  // নাম/ফোন/ঠিকানা দিয়ে একটা নতুন কাস্টমার প্রোফাইল তৈরি করে লিংক করে।
  async function handleCreateCustomer() {
    if (!tenantId || !supplier) return;
    setIsCreatingCustomer(true);
    try {
      const customerId = await createLinkedCustomerFromSupplier(tenantId, {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        address: supplier.address,
      });
      toast.success(t("customerSupplierLink.customerCreated"));
      router.push(`/dashboard/customers/${customerId}`);
    } catch {
      toast.error(t("customerSupplierLink.createCustomerFailed"));
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  async function handleLinkCosting(costing: OrderCosting) {
    if (!tenantId || !user || !costing.supplierId) return;
    setLinkingOrderId(costing.orderId);
    try {
      await linkCostingToSupplierLedger(
        tenantId,
        user.uid,
        user.displayName ?? user.email ?? "",
        {
          orderId: costing.orderId,
          orderNumber: costing.orderNumber,
          supplierId: costing.supplierId,
          rawMaterialCost: costing.rawMaterialCost,
        },
        t("orderCosting.supplierLedgerNote", { orderNumber: costing.orderNumber })
      );
      toast.success(t("orderCosting.supplierLedgerLinked"));
    } catch {
      toast.error(t("orderCosting.supplierLedgerLinkFailed"));
    } finally {
      setLinkingOrderId(null);
    }
  }

  if (!tenantId) return null;

  if (!isLoadingSupplier && !supplier) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/suppliers")}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </button>
        <p className="text-sm text-neutral-400">{t("suppliers.notFound")}</p>
      </div>
    );
  }

  const branchName = supplier ? branches.find((b) => b.id === supplier.branchId)?.name ?? "" : "";
  const hasDue = supplier ? supplier.currentDue > 0 : false;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.push("/dashboard/suppliers")}
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("suppliers.pageTitle")}
      </button>

      {isLoadingSupplier || !supplier ? (
        <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">{supplier.name}</h1>
              <p className="mt-1 text-sm text-neutral-500">
                {supplier.contactPerson || t("suppliers.noContactPerson")} · {branchName}
              </p>
              {supplier.phone && <p className="mt-0.5 text-sm text-neutral-500">{supplier.phone}</p>}
              {supplier.suppliedItems && <p className="mt-0.5 text-sm text-neutral-500">{supplier.suppliedItems}</p>}
              {supplier.address && <p className="mt-0.5 text-xs text-neutral-400">{supplier.address}</p>}
            </div>
            {canManage && (
              <div className="flex shrink-0 gap-2">
                {!supplier.linkedCustomerId && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                      {t("customerSupplierLink.linkToCustomerAction")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCreateCustomer} disabled={isCreatingCustomer}>
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                      {t("customerSupplierLink.createCustomerAction")}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {t("common.edit")}
                </Button>
              </div>
            )}
          </div>

          {supplier.linkedCustomerId && (
            <div className="mt-4 space-y-3">
              <LinkedProfileBanner
                otherRole="customer"
                otherProfileHref={`/dashboard/customers/${supplier.linkedCustomerId}`}
                otherProfileName={supplier.linkedCustomerName ?? ""}
                customerDue={linkedCustomerDue}
                supplierDue={supplier.currentDue}
                canManage={canManage}
                onUnlink={handleUnlink}
              />
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => router.push(`/dashboard/orders/new?customerId=${supplier.linkedCustomerId}`)}
                  >
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    {t("customerSupplierLink.sellAction")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/suppliers/${supplier.id}/purchase`)}
                  >
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                    {t("customerSupplierLink.purchaseAction")}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <div className={`inline-block rounded-lg px-4 py-3 ${hasDue ? "bg-red-50" : "bg-neutral-50"}`}>
              <p className="text-xs text-neutral-500">{t("suppliers.currentDue")}</p>
              <p className={`mt-1 text-xl font-semibold ${hasDue ? "text-status-danger" : "text-status-success"}`}>
                {supplier.currentDue < 0
                  ? t("suppliers.advanceAmount", { amount: formatTaka(Math.abs(supplier.currentDue)) })
                  : formatTaka(supplier.currentDue)}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openTransaction("purchase")}>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                {t("suppliers.type.purchase")}
              </Button>
              <Button size="sm" onClick={() => openTransaction("payment")}>
                <Banknote className="h-4 w-4" aria-hidden="true" />
                {t("suppliers.type.payment")}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-700">{t("suppliers.ledgerHistory")}</h2>
        <SupplierLedgerHistory transactions={transactions} isLoading={isLoadingTx} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-700">{t("suppliers.costingPurchasesTitle")}</h2>
        <SupplierCostingPurchases
          costings={costings}
          isLoading={isLoadingCostings}
          canManage={canManage}
          linkingOrderId={linkingOrderId}
          onLink={handleLinkCosting}
        />
      </div>

      <SupplierTransactionModal
        open={txOpen}
        onOpenChange={setTxOpen}
        tenantId={tenantId}
        supplier={supplier}
        defaultType={txType}
      />

      <SupplierFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenantId={tenantId}
        branches={branches}
        defaultBranchId={supplier?.branchId ?? "all"}
        editingSupplier={supplier}
      />

      {supplier && (
        <LinkCustomerDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          tenantId={tenantId}
          supplier={{ id: supplier.id, name: supplier.name }}
        />
      )}
    </div>
  );
}
