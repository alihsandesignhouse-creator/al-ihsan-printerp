"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import {
  subscribeCustomers,
  loadMoreCustomers,
  subscribeOrdersForFinancials,
  aggregateCustomerFinancials,
} from "@/lib/firebase/customers";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { CustomerFiltersBar } from "@/components/tenant/customers/customer-filters-bar";
import { CustomerListTable } from "@/components/tenant/customers/customer-list-table";
import { CustomerFormDialog } from "@/components/tenant/customers/customer-form-dialog";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { Button } from "@/components/ui/button";
import type { Branch } from "@/lib/types/dashboard";
import type { Tenant } from "@/lib/types/tenant";
import type { Customer, Order } from "@/lib/types/customer";

export default function CustomersListPage() {
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

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(false);
  const [isLoadingMoreCustomers, setIsLoadingMoreCustomers] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [hasDataExportFeature, setHasDataExportFeature] = useState(false);

  const [search, setSearch] = useState("");
  const [dueOnly, setDueOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (data: Tenant | null) => {
        if (!data) return;
        setHasDataExportFeature(computeEffectiveFeatures(data.planId, data.featureOverrides, data.planFeatures).dataExport);
      },
      handleFirestoreError()
    );
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoadingCustomers(true);
    const unsub = subscribeCustomers(
      tenantId,
      (data, hasMore) => {
        setCustomers(data);
        setHasMoreCustomers(hasMore);
        setIsLoadingCustomers(false);
      },
      handleFirestoreError(() => setIsLoadingCustomers(false))
    );
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  async function handleLoadMoreCustomers() {
    if (!tenantId || isLoadingMoreCustomers) return;
    const last = customers[customers.length - 1];
    if (!last) return;
    setIsLoadingMoreCustomers(true);
    try {
      const { items, hasMore } = await loadMoreCustomers(tenantId, last);
      setCustomers((prev) => [...prev, ...items]);
      setHasMoreCustomers(hasMore);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMoreCustomers(false);
    }
  }

  useEffect(() => {
    if (!tenantId) return;
    setIsLoadingOrders(true);
    const unsub = subscribeOrdersForFinancials(
      tenantId,
      effectiveBranchId,
      (data) => {
        setOrders(data);
        setIsLoadingOrders(false);
      },
      handleFirestoreError(() => setIsLoadingOrders(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  const financialsByCustomerId = useMemo(() => aggregateCustomerFinancials(orders), [orders]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (dueOnly) {
        const due = financialsByCustomerId.get(customer.id)?.totalDue ?? 0;
        if (due <= 0) return false;
      }
      if (term) {
        const haystack = `${customer.name} ${customer.phone} ${customer.companyName}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [customers, search, dueOnly, financialsByCustomerId]);

  function openCreate() {
    setEditingCustomer(null);
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer);
    setFormOpen(true);
  }

  const exportRows = useMemo(
    () =>
      filteredCustomers.map((customer) => {
        const fin = financialsByCustomerId.get(customer.id);
        return [
          customer.name,
          customer.phone,
          customer.companyName,
          customer.email,
          customer.address,
          fin?.totalBilled ?? 0,
          fin?.totalPaid ?? 0,
          fin?.totalDue ?? 0,
        ];
      }),
    [filteredCustomers, financialsByCustomerId]
  );

  if (!tenantId || !user) return null;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("customers.pageTitle")}</h1>
        <div className="flex items-center gap-2">
          <CsvExportButton
            hasDataExportFeature={hasDataExportFeature}
            filenamePrefix="al-ihsan-printerp-customers"
            headers={[
              t("customers.name"),
              t("customers.phone"),
              t("customers.companyName"),
              t("customers.email"),
              t("customers.address"),
              t("customers.totalBilled"),
              t("customers.totalPaid"),
              t("customers.totalDue"),
            ]}
            rows={exportRows}
          />
          {canManage && (
            <Button onClick={openCreate}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              {t("customers.newCustomer")}
            </Button>
          )}
        </div>
      </div>

      <CustomerFiltersBar
        search={search}
        onSearchChange={setSearch}
        dueOnly={dueOnly}
        onDueOnlyChange={setDueOnly}
        branches={isTenantAdmin ? branches : []}
        branchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
      />

      {hasMoreCustomers && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("customers.moreCustomersAvailable", { count: customers.length })}</p>
        </div>
      )}

      <CustomerListTable
        tenantId={tenantId}
        userId={user.uid}
        customers={filteredCustomers}
        financialsByCustomerId={financialsByCustomerId}
        isLoading={isLoadingCustomers || isLoadingOrders}
        canManage={canManage}
        onEdit={openEdit}
      />

      {hasMoreCustomers && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMoreCustomers}
            disabled={isLoadingMoreCustomers}
            className="flex h-10 items-center gap-2 rounded-lg border border-brand-primary px-4 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreCustomers && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("customers.loadMore")}
          </button>
        </div>
      )}

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
        editingCustomer={editingCustomer}
      />
    </div>
  );
}
