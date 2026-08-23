"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { subscribeOwnStaffMember } from "@/lib/firebase/users";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import {
  subscribeOrdersForCommissionMonth,
  subscribeOrderCostingsMap,
  subscribeMyWithdrawals,
  loadMoreMyWithdrawals,
} from "@/lib/firebase/commission";
import { computeMyCommissionSummary, currentYearMonth } from "@/lib/utils/commission-math";
import { MonthPicker } from "@/components/tenant/commission/month-picker";
import { WithdrawalListTable } from "@/components/tenant/commission/withdrawal-list-table";
import { WithdrawalRequestDialog } from "@/components/tenant/commission/withdrawal-request-dialog";
import { LockedFeatureNotice } from "@/components/shared/locked-feature-notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTaka } from "@/lib/utils/calculations";
import type { Tenant } from "@/lib/types/tenant";
import type { StaffMember } from "@/lib/types/user";
import type { Order } from "@/lib/types/order";
import type { OrderCosting } from "@/lib/types/order-costing";
import type { StaffWithdrawal } from "@/lib/types/commission";

/**
 * Module T-12 — কমিশন স্টাফের নিজস্ব ভিউ।
 * blueprint T-12 (ভূমিকা: COMMISSION_STAFF) — "নিজের প্রাপ্য কমিশন দেখা ও
 * উত্তোলনের আবেদন"। শুধু commission_staff রোলের জন্য প্রযোজ্য।
 */
export default function MyCommissionPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const uid = user?.uid ?? null;
  const handleFirestoreError = useFirestoreErrorHandler();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoaded, setTenantLoaded] = useState(false);
  const [staffDoc, setStaffDoc] = useState<StaffMember | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [costingsByOrderId, setCostingsByOrderId] = useState<Map<string, OrderCosting>>(new Map());
  const [withdrawals, setWithdrawals] = useState<StaffWithdrawal[]>([]);
  const [hasMoreWithdrawals, setHasMoreWithdrawals] = useState(false);
  const [isLoadingMoreWithdrawals, setIsLoadingMoreWithdrawals] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [requestOpen, setRequestOpen] = useState(false);

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
    if (!tenantId || !uid) return;
    const unsub = subscribeOwnStaffMember(tenantId, uid, setStaffDoc, handleFirestoreError());
    return unsub;
  }, [tenantId, uid, handleFirestoreError]);

  const myBranchId = staffDoc?.branchId ?? null;

  useEffect(() => {
    if (!tenantId || !uid || !myBranchId) return;
    setDataLoaded(false);
    // yearMonth বদলালেই নতুন date-range query — audit ফিক্স (১৭ আগস্ট ২০২৬,
    // দেখুন lib/firebase/commission.ts-এর subscribeOrdersForCommissionMonth কমেন্ট)।
    const unsubOrders = subscribeOrdersForCommissionMonth(
      tenantId,
      myBranchId,
      yearMonth,
      (orders) => setMyOrders(orders.filter((o) => o.takenByStaffId === uid)),
      handleFirestoreError()
    );
    const unsubCostings = subscribeOrderCostingsMap(
      tenantId,
      myBranchId,
      (map) => {
        setCostingsByOrderId(map);
        setDataLoaded(true);
      },
      handleFirestoreError(() => setDataLoaded(true))
    );
    const unsubWithdrawals = subscribeMyWithdrawals(
      tenantId,
      uid,
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
  }, [tenantId, uid, myBranchId, yearMonth, handleFirestoreError]);

  async function handleLoadMoreWithdrawals() {
    if (!tenantId || !uid || isLoadingMoreWithdrawals) return;
    const last = withdrawals[withdrawals.length - 1];
    if (!last) return;
    setIsLoadingMoreWithdrawals(true);
    try {
      const { items, hasMore } = await loadMoreMyWithdrawals(tenantId, uid, last);
      setWithdrawals((prev) => [...prev, ...items]);
      setHasMoreWithdrawals(hasMore);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMoreWithdrawals(false);
    }
  }

  const summary = useMemo(
    () => computeMyCommissionSummary(myOrders, costingsByOrderId, staffDoc?.commissionRate ?? 0, yearMonth),
    [myOrders, costingsByOrderId, staffDoc, yearMonth]
  );

  if (!tenantId || !uid) return null;

  if (!tenantLoaded) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const features = tenant ? computeEffectiveFeatures(tenant.planId, tenant.featureOverrides, tenant.planFeatures) : null;

  if (!features?.commissionSystem) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-neutral-900">{t("commission.myPageTitle")}</h1>
        <LockedFeatureNotice messageKey="commission.locked" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-neutral-900">{t("commission.myPageTitle")}</h1>
        </div>
        <MonthPicker value={yearMonth} onChange={setYearMonth} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label={t("commission.costedOrderCount")} value={String(summary.costedOrderCount)} isLoading={!dataLoaded} />
        <SummaryCard label={t("commission.totalBilled")} value={formatTaka(summary.totalBilled)} isLoading={!dataLoaded} />
        <SummaryCard label={t("commission.rate")} value={`${summary.commissionRate}%`} isLoading={!dataLoaded} />
        <SummaryCard
          label={t("commission.commissionAmount")}
          value={formatTaka(summary.commissionAmount)}
          isLoading={!dataLoaded}
          highlight
        />
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-500">{t("commission.myWithdrawals")}</h2>
          <Button type="button" size="sm" onClick={() => setRequestOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("commission.newWithdrawalRequest")}
          </Button>
        </div>
        <WithdrawalListTable withdrawals={withdrawals} isLoading={!dataLoaded} mode="staff" />

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

      {staffDoc && (
        <WithdrawalRequestDialog
          tenantId={tenantId}
          open={requestOpen}
          onOpenChange={setRequestOpen}
          staff={{ id: uid, name: staffDoc.name, branchId: staffDoc.branchId ?? "" }}
          defaultCommissionMonth={yearMonth}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  isLoading,
  highlight,
}: {
  label: string;
  value: string;
  isLoading: boolean;
  highlight?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="h-3 w-16 animate-pulse rounded bg-neutral-100" />
        <div className="mt-2 h-6 w-20 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${highlight ? "text-brand-primary" : "text-neutral-900"}`}>
        {value}
      </p>
    </div>
  );
}
