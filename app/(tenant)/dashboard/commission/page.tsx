"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeStaffMembers } from "@/lib/firebase/users";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import {
  subscribeOrdersForCommissionMonth,
  subscribeOrderCostingsMap,
  subscribeStaffWithdrawals,
  loadMoreStaffWithdrawals,
} from "@/lib/firebase/commission";
import { computeMonthlyCommissionSummary, currentYearMonth } from "@/lib/utils/commission-math";
import { MonthPicker } from "@/components/tenant/commission/month-picker";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import { CommissionSummaryTable } from "@/components/tenant/commission/commission-summary-table";
import { WithdrawalListTable } from "@/components/tenant/commission/withdrawal-list-table";
import { ProcessWithdrawalDialog } from "@/components/tenant/commission/process-withdrawal-dialog";
import { LockedFeatureNotice } from "@/components/shared/locked-feature-notice";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tenant } from "@/lib/types/tenant";
import type { Branch } from "@/lib/types/dashboard";
import type { StaffMember } from "@/lib/types/user";
import type { Order } from "@/lib/types/order";
import type { OrderCosting } from "@/lib/types/order-costing";
import type { StaffWithdrawal } from "@/lib/types/commission";

/**
 * Module T-12 — স্টাফ কমিশন সিস্টেম, Admin/Branch Manager ভিউ।
 * blueprint অংশ ৯: "প্রাপ্য কমিশন = (মোট বিল − মোট কস্টিং) × কমিশন হার (%)",
 * "মাসওয়ারি দেখা, যেকোনো মাস নির্বাচন"। কমিশন শুধু COMMISSION_STAFF রোলের
 * জন্য এবং শুধু কস্টিং-সহ (hasCosting) অর্ডারের ভিত্তিতে গণনা হয় (নিশ্চিত করা
 * সিদ্ধান্ত)। উত্তোলনের আবেদন স্টাফ নিজেই করেন (/dashboard/my-commission) —
 * এই পৃষ্ঠা থেকে অ্যাডমিন/ব্রাঞ্চ ম্যানেজার শুধু অনুমোদন/প্রত্যাখ্যান করেন।
 */
export default function CommissionPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;

  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);
  // Branch Manager is hard-scoped to their own branch — never "all" — per the
  // T-04-established effectiveBranchId pattern (avoids permission-denied on
  // partial-scope collection reads for non-admin roles).
  const branchScope = role === "branch_manager" ? user?.claims.branchId ?? "all" : selectedBranchId;
  const handleFirestoreError = useFirestoreErrorHandler();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoaded, setTenantLoaded] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [costingsByOrderId, setCostingsByOrderId] = useState<Map<string, OrderCosting>>(new Map());
  const [withdrawals, setWithdrawals] = useState<StaffWithdrawal[]>([]);
  const [hasMoreWithdrawals, setHasMoreWithdrawals] = useState(false);
  const [isLoadingMoreWithdrawals, setIsLoadingMoreWithdrawals] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [reviewTarget, setReviewTarget] = useState<StaffWithdrawal | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

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
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeStaffMembers(
      tenantId,
      branchScope,
      (list) => setStaff(list.filter((s) => s.role === "commission_staff" && s.isActive)),
      handleFirestoreError()
    );
    return unsub;
  }, [tenantId, branchScope, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    setDataLoaded(false);
    // yearMonth বদলালেই নতুন date-range query — audit ফিক্স (১৭ আগস্ট ২০২৬,
    // দেখুন lib/firebase/commission.ts-এর subscribeOrdersForCommissionMonth কমেন্ট)।
    const unsubOrders = subscribeOrdersForCommissionMonth(tenantId, branchScope, yearMonth, setOrders, handleFirestoreError());
    const unsubCostings = subscribeOrderCostingsMap(
      tenantId,
      branchScope,
      (map) => {
        setCostingsByOrderId(map);
        setDataLoaded(true);
      },
      handleFirestoreError(() => setDataLoaded(true))
    );
    const unsubWithdrawals = subscribeStaffWithdrawals(
      tenantId,
      branchScope,
      (data, hasMore) => {
        setWithdrawals(data);
        setHasMoreWithdrawals(hasMore);
      },
      handleFirestoreError()
    );
    return () => {
      unsubOrders();
      unsubCostings();
      unsubWithdrawals();
    };
  }, [tenantId, branchScope, yearMonth, handleFirestoreError]);

  async function handleLoadMoreWithdrawals() {
    if (!tenantId || isLoadingMoreWithdrawals) return;
    const last = withdrawals[withdrawals.length - 1];
    if (!last) return;
    setIsLoadingMoreWithdrawals(true);
    try {
      const { items, hasMore } = await loadMoreStaffWithdrawals(tenantId, branchScope, last);
      setWithdrawals((prev) => [...prev, ...items]);
      setHasMoreWithdrawals(hasMore);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMoreWithdrawals(false);
    }
  }

  const summaryRows = useMemo(
    () => computeMonthlyCommissionSummary(orders, costingsByOrderId, staff, yearMonth),
    [orders, costingsByOrderId, staff, yearMonth]
  );

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;

  function handleReview(withdrawal: StaffWithdrawal) {
    setReviewTarget(withdrawal);
    setReviewOpen(true);
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

  if (!features?.commissionSystem) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-neutral-900">{t("commission.pageTitle")}</h1>
        <LockedFeatureNotice messageKey="commission.locked" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-neutral-900">{t("commission.pageTitle")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role === "tenant_admin" && (
            <BranchFilter branches={branches} selectedBranchId={selectedBranchId} onChange={setSelectedBranchId} />
          )}
          <MonthPicker value={yearMonth} onChange={setYearMonth} />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-500">{t("commission.monthlySummary")}</h2>
        <CommissionSummaryTable rows={summaryRows} isLoading={!dataLoaded} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-500">
          {t("commission.withdrawalRequests")}
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {t("commission.pendingCount", { count: pendingCount })}
            </span>
          )}
        </h2>
        <WithdrawalListTable
          withdrawals={withdrawals}
          isLoading={!dataLoaded}
          mode="admin"
          onProcess={handleReview}
        />

        {hasMoreWithdrawals && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{t("commission.moreWithdrawalsAvailable", { count: withdrawals.length })}</p>
          </div>
        )}

        {hasMoreWithdrawals && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMoreWithdrawals}
              disabled={isLoadingMoreWithdrawals}
              className="flex h-10 items-center gap-2 rounded-lg border border-brand-primary px-4 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMoreWithdrawals && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("commission.loadMoreWithdrawals")}
            </button>
          </div>
        )}
      </section>

      <ProcessWithdrawalDialog
        tenantId={tenantId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        withdrawal={reviewTarget}
        onDone={() => undefined}
      />
    </div>
  );
}
