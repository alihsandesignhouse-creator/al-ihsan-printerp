"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeToOrders, getActiveStaffOptions } from "@/lib/firebase/orders";
import { PendingWorkToolbar, type ViewMode, type SortMode } from "@/components/tenant/pending-work/pending-work-toolbar";
import { PendingWorkTable } from "@/components/tenant/pending-work/pending-work-table";
import { PendingWorkCards } from "@/components/tenant/pending-work/pending-work-cards";
import { PendingWorkKanban } from "@/components/tenant/pending-work/pending-work-kanban";
import { OrderDetailModal } from "@/components/tenant/pending-work/order-detail-modal";
import {
  filterActiveOrders,
  sortByPriority,
  sortByDate,
} from "@/components/tenant/pending-work/pending-work-utils";
import type { Order, StaffOption } from "@/lib/types/order";
import type { Branch } from "@/lib/types/dashboard";

export default function PendingWorkPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);

  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const isAdmin = role === "tenant_admin";
  const canManage = role === "tenant_admin" || role === "branch_manager";

  // Branch scoping: branch_manager/staff are locked to their own branch,
  // tenant_admin uses the global selectedBranchId filter from UIStore.
  // (This exact pattern is now shared via useEffectiveBranchId — see
  // lib/hooks/use-effective-branch-id.ts.)
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);
  const effectiveBranchId = useEffectiveBranchId();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View / sort state — default: table on desktop, card forced on mobile (via CSS)
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortMode, setSortMode] = useState<SortMode>("priority");

  // Detail modal
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function openDetail(order: Order) {
    setSelectedOrderId(order.id);
    setDetailOpen(true);
  }

  // ── Real-time subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);
    const unsub = subscribeToOrders(
      tenantId,
      { branchId: effectiveBranchId, status: "all", staffId: "all" },
      (data) => {
        setOrders(data);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  // ── Branch list (admin only) ──────────────────────────────────────────
  useEffect(() => {
    if (!tenantId || !isAdmin) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, isAdmin, handleFirestoreError]);

  // ── Staff names map (for assignment display) ──────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    getActiveStaffOptions(tenantId, "all")
      .then(setStaffOptions)
      .catch(() => setStaffOptions([]));
  }, [tenantId]);

  const staffNames = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const s of staffOptions) {
      m.set(s.id, s.name);
    }
    return m;
  }, [staffOptions]);

  // ── Filter & sort ─────────────────────────────────────────────────────
  const processedOrders = useMemo(() => {
    const active = filterActiveOrders(orders);
    return sortMode === "priority" ? sortByPriority(active) : sortByDate(active);
  }, [orders, sortMode]);

  if (!tenantId) return null;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          {t("pendingWork.pageTitle")}
        </h1>
        <p className="mt-0.5 text-xs text-neutral-400">{t("pendingWork.subtitle")}</p>
      </div>

      {/* Toolbar: stats + sort + view + branch filter */}
      <PendingWorkToolbar
        orders={processedOrders}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        branches={branches}
        branchId={effectiveBranchId}
        onBranchChange={setSelectedBranchId}
        isAdmin={isAdmin}
      />

      {/*
        ── Render logic ──────────────────────────────────────────────────
        Mobile (< lg): always show cards.
        Desktop (lg+): respect the selected viewMode.
      */}

      {/* Mobile: always card view */}
      <div className="lg:hidden">
        <PendingWorkCards
          tenantId={tenantId}
          orders={processedOrders}
          isLoading={isLoading}
          staffNames={staffNames}
          onCardClick={openDetail}
        />
      </div>

      {/* Desktop: respect viewMode */}
      <div className="hidden lg:block">
        {viewMode === "table" && (
          <PendingWorkTable
            tenantId={tenantId}
            orders={processedOrders}
            isLoading={isLoading}
            staffNames={staffNames}
            onRowClick={openDetail}
          />
        )}
        {viewMode === "card" && (
          <PendingWorkCards
            tenantId={tenantId}
            orders={processedOrders}
            isLoading={isLoading}
            staffNames={staffNames}
            onCardClick={openDetail}
          />
        )}
        {viewMode === "kanban" && (
          <PendingWorkKanban
            tenantId={tenantId}
            orders={processedOrders}
            isLoading={isLoading}
            staffNames={staffNames}
            onCardClick={openDetail}
          />
        )}
      </div>

      {/* Detail modal — opens on row/card click */}
      <OrderDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        tenantId={tenantId}
        orderId={selectedOrderId}
        canManage={canManage}
      />
    </div>
  );
}
