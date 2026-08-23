"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeSuppliers, loadMoreSuppliers } from "@/lib/firebase/suppliers";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { SupplierFiltersBar } from "@/components/tenant/suppliers/supplier-filters-bar";
import { SupplierListTable } from "@/components/tenant/suppliers/supplier-list-table";
import { SupplierFormDialog } from "@/components/tenant/suppliers/supplier-form";
import { SupplierTransactionModal } from "@/components/tenant/suppliers/supplier-transaction-modal";
import { SupplierDueSummary } from "@/components/tenant/suppliers/supplier-due-summary";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { Button } from "@/components/ui/button";
import type { Branch } from "@/lib/types/dashboard";
import type { Supplier, SupplierTransactionType } from "@/lib/types/supplier";

export default function SuppliersListPage() {
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

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [hasMoreSuppliers, setHasMoreSuppliers] = useState(false);
  const [isLoadingMoreSuppliers, setIsLoadingMoreSuppliers] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDataExportFeature, setHasDataExportFeature] = useState(false);

  const [search, setSearch] = useState("");
  const [dueOnly, setDueOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [txOpen, setTxOpen] = useState(false);
  const [txSupplier, setTxSupplier] = useState<Supplier | null>(null);
  const [txType, setTxType] = useState<SupplierTransactionType>("purchase");

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
    const unsub = subscribeSuppliers(
      tenantId,
      effectiveBranchId,
      (data, hasMore) => {
        setSuppliers(data);
        setHasMoreSuppliers(hasMore);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  async function handleLoadMoreSuppliers() {
    if (!tenantId || isLoadingMoreSuppliers) return;
    const last = suppliers[suppliers.length - 1];
    if (!last) return;
    setIsLoadingMoreSuppliers(true);
    try {
      const { items, hasMore } = await loadMoreSuppliers(tenantId, effectiveBranchId, last);
      setSuppliers((prev) => [...prev, ...items]);
      setHasMoreSuppliers(hasMore);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMoreSuppliers(false);
    }
  }

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (dueOnly && supplier.currentDue <= 0) return false;
      if (term) {
        const haystack = `${supplier.name} ${supplier.phone} ${supplier.suppliedItems} ${supplier.contactPerson}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [suppliers, search, dueOnly]);

  function openCreate() {
    setEditingSupplier(null);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setFormOpen(true);
  }

  function openTransaction(supplier: Supplier, type: SupplierTransactionType) {
    setTxSupplier(supplier);
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
      filteredSuppliers.map((supplier) => [
        supplier.name,
        supplier.phone,
        supplier.contactPerson,
        supplier.suppliedItems,
        supplier.address,
        supplier.currentDue,
        branchNameById.get(supplier.branchId) ?? "",
      ]),
    [filteredSuppliers, branchNameById]
  );

  if (!tenantId) return null;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("suppliers.pageTitle")}</h1>
        <div className="flex items-center gap-2">
          <CsvExportButton
            hasDataExportFeature={hasDataExportFeature}
            filenamePrefix="al-ihsan-printerp-suppliers"
            headers={[
              t("suppliers.name"),
              t("suppliers.phone"),
              t("suppliers.contactPerson"),
              t("suppliers.suppliedItems"),
              t("suppliers.address"),
              t("suppliers.currentDue"),
              t("expenses.branch"),
            ]}
            rows={exportRows}
          />
          {canManage && (
            <Button onClick={openCreate}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              {t("suppliers.newSupplier")}
            </Button>
          )}
        </div>
      </div>

      <SupplierDueSummary suppliers={suppliers} />

      <SupplierFiltersBar
        search={search}
        onSearchChange={setSearch}
        branches={isTenantAdmin ? branches : []}
        branchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        dueOnly={dueOnly}
        onDueOnlyChange={setDueOnly}
      />

      {hasMoreSuppliers && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("suppliers.moreSuppliersAvailable", { count: suppliers.length })}</p>
        </div>
      )}

      <SupplierListTable
        tenantId={tenantId}
        suppliers={filteredSuppliers}
        branches={branches}
        isLoading={isLoading}
        canManage={canManage}
        onEdit={openEdit}
        onTransaction={openTransaction}
      />

      {hasMoreSuppliers && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMoreSuppliers}
            disabled={isLoadingMoreSuppliers}
            className="flex h-10 items-center gap-2 rounded-lg border border-brand-primary px-4 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreSuppliers && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("suppliers.loadMore")}
          </button>
        </div>
      )}

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
        branches={branches}
        defaultBranchId={effectiveBranchId}
        editingSupplier={editingSupplier}
      />

      <SupplierTransactionModal
        open={txOpen}
        onOpenChange={setTxOpen}
        tenantId={tenantId}
        supplier={txSupplier}
        defaultType={txType}
      />
    </div>
  );
}
