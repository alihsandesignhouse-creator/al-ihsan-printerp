"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HandCoins, ClipboardList, Activity, Wallet, FileWarning, ArrowRight, Search } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { subscribeOwnStaffMember } from "@/lib/firebase/users";
import { subscribeToOrders } from "@/lib/firebase/orders";
import { subscribeOrdersForCommissionMonth, subscribeOrderCostingsMap } from "@/lib/firebase/commission";
import { computeMyCommissionSummary, currentYearMonth } from "@/lib/utils/commission-math";
import { KpiCard } from "@/components/shared/kpi-card";
import { MyCollectionOrderTable } from "@/components/tenant/my-collection/my-collection-order-table";
import { Input } from "@/components/ui/input";
import { formatTaka } from "@/lib/utils/calculations";
import type { Tenant } from "@/lib/types/tenant";
import type { StaffMember } from "@/lib/types/user";
import type { Order, OrderStatusFilter } from "@/lib/types/order";
import type { OrderCosting } from "@/lib/types/order-costing";

const STATUS_FILTERS: OrderStatusFilter[] = ["all", "pending", "in_progress", "ready", "delivered", "cancelled"];
const ACTIVE_STATUSES = new Set(["pending", "in_progress", "ready"]);

/**
 * Module T-19 — My Collection: কমিশন স্টাফের ব্যক্তিগত কর্মক্ষেত্র।
 * blueprint T-19: "নিজের অর্ডার তালিকা, কস্টিং এন্ট্রি, পেমেন্ট সংগ্রহ,
 * প্রাপ্য কমিশনের মাসওয়ারি হিসাব, উত্তোলনের আবেদন ও ইতিহাস, ডেলিভারি চালান প্রিন্ট"।
 *
 * এই সেশনের সিদ্ধান্ত: কমিশনের মাসওয়ারি হিসাব ও উত্তোলন ইতিমধ্যে T-12-এ
 * সম্পূর্ণরূপে তৈরি (`/dashboard/my-commission`) — এখানে পুনরায় তৈরি না করে
 * একটি সংক্ষিপ্ত এই-মাসের সারাংশ কার্ড + "বিস্তারিত ও উত্তোলন" লিংক দেখানো
 * হয়েছে। একইভাবে কস্টিং এন্ট্রি ও চালান প্রিন্ট অর্ডার ডিটেইল পেজেই থাকে —
 * এখান থেকে সরাসরি সেই পেজে লিংক করা হয়েছে (ডুপ্লিকেশন এড়াতে)।
 */
export default function MyCollectionPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const uid = user?.uid ?? null;
  const effectiveBranchId = useEffectiveBranchId();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [staffDoc, setStaffDoc] = useState<StaffMember | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [commissionOrders, setCommissionOrders] = useState<Order[]>([]);
  const [costingsByOrderId, setCostingsByOrderId] = useState<Map<string, OrderCosting>>(new Map());

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatusFilter>("all");

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(tenantId, setTenant, handleFirestoreError());
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !uid) return;
    const unsub = subscribeOwnStaffMember(tenantId, uid, setStaffDoc, handleFirestoreError());
    return unsub;
  }, [tenantId, uid, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !uid) return;
    setIsLoading(true);
    const unsub = subscribeToOrders(
      tenantId,
      { branchId: effectiveBranchId, status: "all", staffId: uid },
      (data) => {
        setOrders(data);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return unsub;
  }, [tenantId, uid, effectiveBranchId, handleFirestoreError]);

  const features = tenant ? computeEffectiveFeatures(tenant.planId, tenant.featureOverrides, tenant.planFeatures) : null;
  const hasCommissionFeature = features?.commissionSystem ?? false;
  const hasCostingFeature = features?.costingManagement ?? false;

  // এই মাসের কমিশন সারাংশ (সংক্ষিপ্ত কার্ড) — শুধু commissionSystem ফিচার-সহ tenant-এ।
  // audit ফিক্স (১৭ আগস্ট ২০২৬): আগে all-time capped fetch ব্যবহার হতো;
  // এখন সরাসরি চলতি মাসের date-range query (দেখুন lib/firebase/commission.ts)।
  const myBranchId = staffDoc?.branchId ?? null;
  useEffect(() => {
    if (!tenantId || !uid || !myBranchId || !hasCommissionFeature) return;
    const unsubOrders = subscribeOrdersForCommissionMonth(
      tenantId,
      myBranchId,
      currentYearMonth(),
      (data) => setCommissionOrders(data.filter((o) => o.takenByStaffId === uid)),
      handleFirestoreError()
    );
    const unsubCostings = subscribeOrderCostingsMap(tenantId, myBranchId, setCostingsByOrderId, handleFirestoreError());
    return () => {
      unsubOrders();
      unsubCostings();
    };
  }, [tenantId, uid, myBranchId, hasCommissionFeature, handleFirestoreError]);

  const commissionSummary = useMemo(
    () =>
      computeMyCommissionSummary(commissionOrders, costingsByOrderId, staffDoc?.commissionRate ?? 0, currentYearMonth()),
    [commissionOrders, costingsByOrderId, staffDoc]
  );

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (term) {
        const haystack = `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.itemSummary}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [orders, search, status]);

  const kpis = useMemo(() => {
    const activeCount = orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length;
    const totalDue = orders.reduce((sum, o) => sum + (o.dueAmount > 0 ? o.dueAmount : 0), 0);
    const needsCostingCount = orders.filter((o) => !o.hasCosting && o.status !== "cancelled").length;
    return { totalOrders: orders.length, activeCount, totalDue, needsCostingCount };
  }, [orders]);

  if (!tenantId || !uid) return null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <HandCoins className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-neutral-900">{t("myCollection.pageTitle")}</h1>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label={t("myCollection.totalOrders")} value={String(kpis.totalOrders)} icon={ClipboardList} accentColor="primary" isLoading={isLoading} />
          <KpiCard label={t("myCollection.activeOrders")} value={String(kpis.activeCount)} icon={Activity} accentColor="info" isLoading={isLoading} />
          <KpiCard label={t("myCollection.totalDue")} value={formatTaka(kpis.totalDue)} icon={Wallet} accentColor="danger" isLoading={isLoading} />
          {hasCostingFeature && (
            <KpiCard
              label={t("myCollection.needsCosting")}
              value={String(kpis.needsCostingCount)}
              icon={FileWarning}
              accentColor="warning"
              isLoading={isLoading}
            />
          )}
        </div>

        {hasCommissionFeature && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">{t("myCollection.monthlyCommission")}</p>
              <p className="mt-1 text-xl font-semibold text-brand-primary">{formatTaka(commissionSummary.commissionAmount)}</p>
            </div>
            <Link
              href="/dashboard/my-commission"
              className="flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
            >
              {t("myCollection.viewCommissionDetails")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("orders.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`h-9 rounded-lg px-3 text-sm font-medium transition-colors ${
                  status === s
                    ? "bg-brand-primary text-white"
                    : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {t(s === "all" ? "common.all" : `orders.status.${s}`)}
              </button>
            ))}
          </div>
        </div>

        <MyCollectionOrderTable
          tenantId={tenantId}
          orders={filteredOrders}
          isLoading={isLoading}
          showCostingIndicator={hasCostingFeature}
        />
      </div>
    </div>
  );
}
