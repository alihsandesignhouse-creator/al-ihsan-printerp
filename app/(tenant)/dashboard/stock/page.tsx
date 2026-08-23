"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeStockItems, loadMoreStockItems } from "@/lib/firebase/stock";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { StockFiltersBar } from "@/components/tenant/stock/stock-filters-bar";
import { StockListTable } from "@/components/tenant/stock/stock-list-table";
import { StockItemFormDialog } from "@/components/tenant/stock/stock-item-form";
import { StockTransactionModal } from "@/components/tenant/stock/stock-transaction-modal";
import { LowStockAlert } from "@/components/tenant/stock/low-stock-alert";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { Button } from "@/components/ui/button";
import type { Branch } from "@/lib/types/dashboard";
import type { StockItem } from "@/lib/types/stock";

export default function StockListPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const isTenantAdmin = role === "tenant_admin";
  const canManage = isTenantAdmin || role === "branch_manager";

  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);
  // Non-admin roles are always scoped to their own branch — see
  // lib/hooks/use-effective-branch-id.ts for why this is required, not optional.
  const effectiveBranchId = useEffectiveBranchId();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [items, setItems] = useState<StockItem[]>([]);
  const [hasMoreStock, setHasMoreStock] = useState(false);
  const [isLoadingMoreStock, setIsLoadingMoreStock] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDataExportFeature, setHasDataExportFeature] = useState(false);

  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  const [txOpen, setTxOpen] = useState(false);
  const [txItem, setTxItem] = useState<StockItem | null>(null);
  const [txType, setTxType] = useState<"in" | "out">("in");

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (data) => {
        if (!data) return;
        setHasDataExportFeature(computeEffectiveFeatures(data.planId, data.featureOverrides, data.planFeatures).dataExport);
      },
      handleFirestoreError()
    );
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);
    const unsub = subscribeStockItems(
      tenantId,
      effectiveBranchId,
      (data, hasMore) => {
        setItems(data);
        setHasMoreStock(hasMore);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  async function handleLoadMoreStock() {
    if (!tenantId || isLoadingMoreStock) return;
    const last = items[items.length - 1];
    if (!last) return;
    setIsLoadingMoreStock(true);
    try {
      const { items: nextBatch, hasMore } = await loadMoreStockItems(tenantId, effectiveBranchId, last);
      setItems((prev) => [...prev, ...nextBatch]);
      setHasMoreStock(hasMore);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMoreStock(false);
    }
  }

  const lowStockItems = useMemo(() => items.filter((i) => i.currentStock <= i.minimumLevel), [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (lowStockOnly && item.currentStock > item.minimumLevel) return false;
      if (term) {
        const haystack = `${item.name} ${item.category} ${item.unit}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [items, search, lowStockOnly]);

  function openCreate() {
    setEditingItem(null);
    setFormOpen(true);
  }

  function openEdit(item: StockItem) {
    setEditingItem(item);
    setFormOpen(true);
  }

  function openTransaction(item: StockItem, type: "in" | "out") {
    setTxItem(item);
    setTxType(type);
    setTxOpen(true);
  }

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branches) map.set(b.id, b.name);
    return map;
  }, [branches]);

  const exportRows = useMemo(
    () =>
      filteredItems.map((item) => [
        item.name,
        item.category,
        item.unit,
        item.currentStock,
        item.minimumLevel,
        branchNameById.get(item.branchId) ?? "",
      ]),
    [filteredItems, branchNameById]
  );

  if (!tenantId) return null;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("stock.pageTitle")}</h1>
        <div className="flex items-center gap-2">
          <CsvExportButton
            hasDataExportFeature={hasDataExportFeature}
            filenamePrefix="al-ihsan-printerp-stock"
            headers={[
              t("stock.itemName"),
              t("stock.category"),
              t("stock.unit"),
              t("stock.currentStock"),
              t("stock.minimumLevel"),
              t("expenses.branch"),
            ]}
            rows={exportRows}
          />
          {canManage && (
            <Button onClick={openCreate}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              {t("stock.newItem")}
            </Button>
          )}
        </div>
      </div>

      <LowStockAlert items={lowStockItems} />

      <StockFiltersBar
        search={search}
        onSearchChange={setSearch}
        branches={isTenantAdmin ? branches : []}
        branchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        lowStockOnly={lowStockOnly}
        onLowStockOnlyChange={setLowStockOnly}
      />

      {hasMoreStock && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("stock.moreStockAvailable", { count: items.length })}</p>
        </div>
      )}

      <StockListTable
        tenantId={tenantId}
        items={filteredItems}
        branches={branches}
        isLoading={isLoading}
        canManage={canManage}
        onEdit={openEdit}
        onTransaction={openTransaction}
      />

      {hasMoreStock && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMoreStock}
            disabled={isLoadingMoreStock}
            className="flex h-10 items-center gap-2 rounded-lg border border-brand-primary px-4 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreStock && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("stock.loadMore")}
          </button>
        </div>
      )}

      <StockItemFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
        branches={branches}
        defaultBranchId={effectiveBranchId}
        editingItem={editingItem}
      />

      <StockTransactionModal
        open={txOpen}
        onOpenChange={setTxOpen}
        tenantId={tenantId}
        item={txItem}
        defaultType={txType}
      />
    </div>
  );
}
