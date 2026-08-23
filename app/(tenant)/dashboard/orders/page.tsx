"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeToOrders, loadMoreOrders, getActiveStaffOptions } from "@/lib/firebase/orders";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { OrderListTable } from "@/components/tenant/orders/order-list-table";
import { OrderFiltersBar } from "@/components/tenant/orders/order-filters-bar";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { formatDateLocalized } from "@/lib/utils/format";
import type { Order } from "@/lib/types/order";
import type { Branch } from "@/lib/types/dashboard";
import type { OrderStatusFilter, StaffOption } from "@/lib/types/order";

/** useSearchParams() requires Suspense boundary in Next.js App Router. */
export default function OrdersListPage() {
  return (
    <Suspense>
      <OrdersListPageInner />
    </Suspense>
  );
}

function OrdersListPageInner() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const isTenantAdmin = role === "tenant_admin";
  const canCreateOrder = role === "tenant_admin" || role === "branch_manager" || role === "commission_staff";

  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);
  // Non-admin roles are always scoped to their own branch — passing the raw
  // "all" default straight into a branch-scoped Firestore query fails the
  // ENTIRE query with permission-denied for them. See use-effective-branch-id.ts.
  const effectiveBranchId = useEffectiveBranchId();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  // "আরও লোড করুন"-এ আনা অতিরিক্ত ব্যাচ — এগুলো static (non-realtime),
  // subscribeToOrders/orders.ts-এর loadMoreOrders() ডকুমেন্টেশন দেখুন।
  const [extraOrders, setExtraOrders] = useState<Order[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [costingEnabled, setCostingEnabled] = useState(false);
  const [hasDataExportFeature, setHasDataExportFeature] = useState(false);

  const orders = useMemo(() => [...liveOrders, ...extraOrders], [liveOrders, extraOrders]);

  // URL param drilldown from dashboard KPI cards ও রিপোর্ট পেজ (সেশন ৬, ১৮ আগস্ট ২০২৬):
  //   ?filter=active    → pending/in_progress/ready (চলমান অর্ডার)
  //   ?filter=due       → dueOnly=true (মোট বকেয়া)
  //   ?status=delivered → status="delivered"
  //   ?q=...            → search বক্স প্রি-ফিল (item analysis টেবিল drilldown)
  //   ?staffId=...      → নির্দিষ্ট স্টাফের অর্ডার (staff performance টেবিল drilldown)
  const urlFilter = searchParams.get("filter");
  const urlStatus = searchParams.get("status") as OrderStatusFilter | null;
  const urlQ = searchParams.get("q");
  const urlStaffId = searchParams.get("staffId");

  const [search, setSearch] = useState(() => urlQ ?? "");
  const [status, setStatus] = useState<OrderStatusFilter>(() => {
    if (urlStatus === "delivered") return "delivered";
    return "all";
  });
  const [activeOnly, setActiveOnly] = useState(() => urlFilter === "active");
  const [staffId, setStaffId] = useState<string | "all">(() => urlStaffId ?? "all");
  const [dueOnly, setDueOnly] = useState(() => urlFilter === "due");

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (data) => {
        if (!data) return;
        const features = computeEffectiveFeatures(data.planId, data.featureOverrides, data.planFeatures);
        setCostingEnabled(features.costingManagement);
        setHasDataExportFeature(features.dataExport);
      },
      handleFirestoreError()
    );
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    getActiveStaffOptions(tenantId, "all").then(setStaffOptions).catch(() => setStaffOptions([]));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);
    // শাখা বদলালে আগের "আরও লোড করুন" ব্যাচ এই নতুন query-র সাথে অসামঞ্জস্যপূর্ণ
    // হয়ে যায় — রিসেট করা হলো, নাহলে ভুল শাখার পুরনো অর্ডার তালিকায় থেকে যেত।
    setExtraOrders([]);
    const unsub = subscribeToOrders(
      tenantId,
      { branchId: effectiveBranchId, status: "all", staffId: "all" },
      (data, more) => {
        setLiveOrders(data);
        setHasMore(more);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  async function handleLoadMore() {
    if (!tenantId || isLoadingMore) return;
    const lastOrder = orders[orders.length - 1];
    if (!lastOrder) return;
    setIsLoadingMore(true);
    try {
      const { orders: nextBatch, hasMore: more } = await loadMoreOrders(
        tenantId,
        { branchId: effectiveBranchId },
        lastOrder
      );
      setExtraOrders((prev) => [...prev, ...nextBatch]);
      setHasMore(more);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMore(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (activeOnly) {
        // "চলমান অর্ডার" = pending + in_progress + ready (dashboard KPI-র সাথে সামঞ্জস্যপূর্ণ)
        if (!["pending", "in_progress", "ready"].includes(order.status)) return false;
      } else if (status !== "all" && order.status !== status) {
        return false;
      }
      if (staffId !== "all" && order.takenByStaffId !== staffId && order.assignedStaffId !== staffId) return false;
      if (dueOnly && order.dueAmount <= 0) return false;
      if (term) {
        const haystack = `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.itemSummary}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [orders, activeOnly, status, staffId, dueOnly, search]);

  const exportRows = useMemo(
    () =>
      filteredOrders.map((order) => [
        order.orderNumber,
        order.customerName,
        order.customerPhone,
        order.itemSummary,
        order.expectedDeliveryDate?.toDate?.() ? formatDateLocalized(order.expectedDeliveryDate.toDate(), locale) : "",
        t(`orders.status.${order.status}`),
        order.totalAmount,
        order.advanceAmount,
        order.dueAmount,
      ]),
    [filteredOrders, t, locale]
  );

  if (!tenantId) return null;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("orders.pageTitle")}</h1>
        <div className="flex items-center gap-2">
          <CsvExportButton
            hasDataExportFeature={hasDataExportFeature}
            filenamePrefix="al-ihsan-printerp-orders"
            headers={[
              t("orders.orderNumber"),
              t("orders.customer"),
              t("customers.phone"),
              t("orders.items"),
              t("orders.deliveryDate"),
              t("orders.statusColumn"),
              t("reports.totalRevenue"),
              t("orders.advanceAmount"),
              t("orders.dueAmount"),
            ]}
            rows={exportRows}
          />
          {canCreateOrder && (
            <Link
              href="/dashboard/orders/new"
              className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              {t("nav.newOrder")}
            </Link>
          )}
        </div>
      </div>

      <OrderFiltersBar
        search={search}
        onSearchChange={setSearch}
        status={activeOnly ? "all" : status}
        onStatusChange={(s) => { setActiveOnly(false); setStatus(s); }}
        branches={isTenantAdmin ? branches : []}
        branchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        staffOptions={staffOptions}
        staffId={staffId}
        onStaffChange={setStaffId}
        dueOnly={dueOnly}
        onDueOnlyChange={(v) => { setActiveOnly(false); setDueOnly(v); }}
      />

      {hasMore && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("orders.moreOrdersAvailable", { count: orders.length })}</p>
        </div>
      )}

      <OrderListTable
        tenantId={tenantId}
        orders={filteredOrders}
        isLoading={isLoading}
        showCostingIndicator={costingEnabled}
      />

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="flex h-10 items-center gap-2 rounded-lg border border-brand-primary px-4 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("orders.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
