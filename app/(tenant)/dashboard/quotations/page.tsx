"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeToQuotations, loadMoreQuotations } from "@/lib/firebase/quotations";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { QuotationListTable } from "@/components/tenant/quotations/quotation-list-table";
import { QuotationFiltersBar } from "@/components/tenant/quotations/quotation-filters-bar";
import { LockedFeatureNotice } from "@/components/shared/locked-feature-notice";
import { Skeleton } from "@/components/ui/skeleton";
import type { Quotation, QuotationStatusFilter } from "@/lib/types/quotation";
import type { Branch } from "@/lib/types/dashboard";
import type { Tenant } from "@/lib/types/tenant";

export default function QuotationsListPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const isTenantAdmin = role === "tenant_admin";
  const canManage = role === "tenant_admin" || role === "branch_manager";

  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);
  // Non-admin roles are always scoped to their own branch — passing the raw
  // "all" default straight into a branch-scoped Firestore query fails the
  // ENTIRE query with permission-denied for them. See use-effective-branch-id.ts.
  const effectiveBranchId = useEffectiveBranchId();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoaded, setTenantLoaded] = useState(false);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [hasMoreQuotations, setHasMoreQuotations] = useState(false);
  const [isLoadingMoreQuotations, setIsLoadingMoreQuotations] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuotationStatusFilter>("all");

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (data) => {
        setTenant(data);
        setTenantLoaded(true);
      },
      handleFirestoreError(() => setTenantLoaded(true))
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
    setIsLoading(true);
    const unsub = subscribeToQuotations(
      tenantId,
      { branchId: effectiveBranchId, status: "all" },
      (data, hasMore) => {
        setQuotations(data);
        setHasMoreQuotations(hasMore);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  async function handleLoadMoreQuotations() {
    if (!tenantId || isLoadingMoreQuotations) return;
    const last = quotations[quotations.length - 1];
    if (!last) return;
    setIsLoadingMoreQuotations(true);
    try {
      const { items, hasMore } = await loadMoreQuotations(tenantId, effectiveBranchId, last);
      setQuotations((prev) => [...prev, ...items]);
      setHasMoreQuotations(hasMore);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMoreQuotations(false);
    }
  }

  const filteredQuotations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotations.filter((quotation) => {
      if (status !== "all" && quotation.status !== status) return false;
      if (term) {
        const haystack = `${quotation.quotationNumber} ${quotation.recipientName} ${quotation.recipientPhone} ${quotation.recipientCompany} ${quotation.itemSummary}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [quotations, status, search]);

  if (!tenantId) return null;

  if (!tenantLoaded) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const features = tenant ? computeEffectiveFeatures(tenant.planId, tenant.featureOverrides, tenant.planFeatures) : null;

  if (!features?.quotations) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-neutral-900">{t("quotations.pageTitle")}</h1>
        <LockedFeatureNotice messageKey="quotations.locked" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("quotations.pageTitle")}</h1>
        {canManage && (
          <Link
            href="/dashboard/quotations/new"
            className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {t("quotations.newQuotation")}
          </Link>
        )}
      </div>

      <QuotationFiltersBar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        branches={isTenantAdmin ? branches : []}
        branchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
      />

      {hasMoreQuotations && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("quotations.moreQuotationsAvailable", { count: quotations.length })}</p>
        </div>
      )}

      <QuotationListTable tenantId={tenantId} quotations={filteredQuotations} isLoading={isLoading} />

      {hasMoreQuotations && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMoreQuotations}
            disabled={isLoadingMoreQuotations}
            className="flex h-10 items-center gap-2 rounded-lg border border-brand-primary px-4 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreQuotations && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("quotations.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
