"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeOutsourceRecords, loadMoreOutsourceRecords } from "@/lib/firebase/outsource";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { OutsourceFiltersBar } from "@/components/tenant/outsource/outsource-filters-bar";
import { OutsourceListTable } from "@/components/tenant/outsource/outsource-list-table";
import { OutsourceFormDialog } from "@/components/tenant/outsource/outsource-form-dialog";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { LockedFeatureNotice } from "@/components/shared/locked-feature-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDateLocalized } from "@/lib/utils/format";
import type { Branch } from "@/lib/types/dashboard";
import type { OutsourceRecord, OutsourceStatus } from "@/lib/types/outsource";
import type { Tenant } from "@/lib/types/tenant";

/**
 * Module T-17 (blueprint অংশ ৯, প্রিমিয়াম), audit item #৭: এতদিন শুধু
 * `planFeatures.outsourceTracking` ফ্ল্যাগ ও sidebar লিংক ছিল, কোনো
 * পেজ/CRUD ছিল না। expenses page-এর সাথে হুবহু একই কাঠামো (filters-bar +
 * list-table + form-dialog), কিন্তু quotations page-এর মতো পুরো-পেজ
 * LockedFeatureNotice দিয়ে গেটেড যেহেতু এটা premium-only (standardPlus নয়)।
 */
export default function OutsourcePage() {
  const t = useTranslations();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const isTenantAdmin = role === "tenant_admin";
  const canManage = isTenantAdmin; // sidebar.tsx-এ ইতিমধ্যে roles: ["tenant_admin"] দিয়ে গেটেড

  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);
  const effectiveBranchId = isTenantAdmin ? selectedBranchId : (user?.claims.branchId ?? "all");
  const handleFirestoreError = useFirestoreErrorHandler();

  const [records, setRecords] = useState<OutsourceRecord[]>([]);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [isLoadingMoreRecords, setIsLoadingMoreRecords] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoaded, setTenantLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OutsourceStatus | "all">("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OutsourceRecord | null>(null);

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
        setTenant(data);
        setTenantLoaded(true);
      },
      handleFirestoreError(() => setTenantLoaded(true))
    );
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);
    const unsub = subscribeOutsourceRecords(
      tenantId,
      effectiveBranchId,
      (data, hasMore) => {
        setRecords(data);
        setHasMoreRecords(hasMore);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  async function handleLoadMoreRecords() {
    if (!tenantId || isLoadingMoreRecords) return;
    const last = records[records.length - 1];
    if (!last) return;
    setIsLoadingMoreRecords(true);
    try {
      const { items, hasMore } = await loadMoreOutsourceRecords(tenantId, effectiveBranchId, last);
      setRecords((prev) => [...prev, ...items]);
      setHasMoreRecords(hasMore);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMoreRecords(false);
    }
  }

  const formBranches = useMemo(
    () => (isTenantAdmin ? branches : branches.filter((b) => b.id === user?.claims.branchId)),
    [isTenantAdmin, branches, user?.claims.branchId]
  );

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (term) {
        const haystack = `${r.vendorName} ${r.workDescription} ${r.relatedOrderNumber}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [records, search, status]);

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branches) map.set(b.id, b.name);
    return map;
  }, [branches]);

  const exportRows = useMemo(
    () =>
      filteredRecords.map((r) => [
        r.vendorName,
        r.workDescription,
        r.relatedOrderNumber,
        r.sentDate?.toDate?.() ? formatDateLocalized(r.sentDate.toDate(), locale) : "",
        r.expectedReturnDate?.toDate?.() ? formatDateLocalized(r.expectedReturnDate.toDate(), locale) : "",
        branchNameById.get(r.branchId) ?? "",
        t(`outsource.statusValue.${r.status}`),
        r.cost,
      ]),
    [filteredRecords, branchNameById, t, locale]
  );

  function openCreate() {
    setEditingRecord(null);
    setFormOpen(true);
  }

  function openEdit(record: OutsourceRecord) {
    setEditingRecord(record);
    setFormOpen(true);
  }

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

  if (!features?.outsourceTracking) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-neutral-900">{t("outsource.pageTitle")}</h1>
        <LockedFeatureNotice messageKey="outsource.locked" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("outsource.pageTitle")}</h1>
        <div className="flex items-center gap-2">
          <CsvExportButton
            hasDataExportFeature={features.dataExport}
            filenamePrefix="al-ihsan-printerp-outsource"
            headers={[
              t("outsource.vendorName"),
              t("outsource.workDescription"),
              t("outsource.relatedOrderNumber"),
              t("outsource.sentDate"),
              t("outsource.expectedReturnDate"),
              t("expenses.branch"),
              t("outsource.status"),
              t("outsource.cost"),
            ]}
            rows={exportRows}
          />
          {canManage && (
            <Button onClick={openCreate}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              {t("outsource.newRecord")}
            </Button>
          )}
        </div>
      </div>

      <OutsourceFiltersBar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        branches={isTenantAdmin ? branches : []}
        branchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
      />

      {hasMoreRecords && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("outsource.moreRecordsAvailable", { count: records.length })}</p>
        </div>
      )}

      <OutsourceListTable
        tenantId={tenantId}
        records={filteredRecords}
        branches={branches}
        isLoading={isLoading}
        canManage={canManage}
        onEdit={openEdit}
      />

      {hasMoreRecords && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMoreRecords}
            disabled={isLoadingMoreRecords}
            className="flex h-10 items-center gap-2 rounded-lg border border-brand-primary px-4 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreRecords && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("outsource.loadMore")}
          </button>
        </div>
      )}

      <OutsourceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
        branches={formBranches}
        defaultBranchId={effectiveBranchId}
        editingRecord={editingRecord}
      />
    </div>
  );
}
