"use client";

import { useEffect, useState } from "react";
import {
  subscribeOrders,
  subscribeTodayPayments,
  subscribeMonthPayments,
  subscribeBranches,
  computeDashboardKpis,
  computeMonthlyChartSeries,
  computeDailyCollectionSeries,
  computeDeliveryHighlights,
  computeStaffSummary,
} from "@/lib/firebase/dashboard";
import { subscribeOrderCostingsMap } from "@/lib/firebase/commission";
import { subscribeMonthExpenses } from "@/lib/firebase/expenses";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { computeMyCommissionSummary, currentYearMonth } from "@/lib/utils/commission-math";
import type {
  Order,
  Payment,
  Branch,
  DashboardKpis,
  MonthlyChartPoint,
  DailyCollectionPoint,
  DeliveryHighlight,
  StaffDashboardSummary,
} from "@/lib/types/dashboard";
import type { OrderCosting } from "@/lib/types/order-costing";
import type { Expense } from "@/lib/types/expense";

interface UseAdminDashboardDataResult {
  kpis: DashboardKpis;
  todayDeliveries: DeliveryHighlight[];
  tomorrowDeliveries: DeliveryHighlight[];
  monthlyChartData: MonthlyChartPoint[];
  dailyCollectionData: DailyCollectionPoint[];
  branches: Branch[];
  isLoading: boolean;
  error: string | null;
}

const EMPTY_KPIS: DashboardKpis = {
  totalOrders: 0,
  activeOrders: 0,
  deliveredThisMonth: 0,
  totalDue: 0,
  todayCollection: 0,
  monthlyRevenue: 0,
  monthlyExpense: null,
  netProfit: null,
};

/**
 * Orchestrates all Firestore subscriptions required for the admin/branch-manager
 * dashboard and derives KPIs + chart series client-side. Designed to work fully
 * offline using Firestore's cached snapshots (blueprint section 5.2).
 */
export function useAdminDashboardData(
  tenantId: string | null,
  branchId: string | "all",
  hasNetProfitFeature: boolean
): UseAdminDashboardDataResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayPayments, setTodayPayments] = useState<Payment[]>([]);
  const [monthPayments, setMonthPayments] = useState<Payment[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [costingsByOrderId, setCostingsByOrderId] = useState<Map<string, OrderCosting>>(new Map());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleFirestoreError = useFirestoreErrorHandler();

  useEffect(() => {
    if (!tenantId) return;
    setOrdersLoaded(false);

    const notify = handleFirestoreError();
    const onError = (err: Error) => {
      setError(err.message);
      notify(err);
    };

    const unsubOrders = subscribeOrders(
      tenantId,
      branchId,
      (data) => {
        setOrders(data);
        setOrdersLoaded(true);
      },
      onError
    );

    const unsubToday = subscribeTodayPayments(tenantId, branchId, setTodayPayments, onError);

    const unsubMonth = subscribeMonthPayments(tenantId, branchId, setMonthPayments, onError);

    const unsubExpenses = subscribeMonthExpenses(tenantId, branchId, setMonthExpenses, onError);

    // ১৬ আগস্ট ২০২৬ ফিক্স: netProfit KPI-তে কস্টিং যোগ করার জন্য — শুধু plan-এ
    // advancedReports থাকলেই লোড হয় (basic প্ল্যানে netProfit দেখানোই হয় না,
    // costingManagement সবসময় advancedReports-এর একই টায়ারে বান্ডেল করা)।
    const unsubCostings = hasNetProfitFeature
      ? subscribeOrderCostingsMap(tenantId, branchId, setCostingsByOrderId, onError)
      : undefined;

    const unsubBranches = subscribeBranches(tenantId, setBranches, onError);

    return () => {
      unsubOrders();
      unsubToday();
      unsubMonth();
      unsubExpenses();
      unsubCostings?.();
      unsubBranches();
    };
  }, [tenantId, branchId, hasNetProfitFeature, handleFirestoreError]);

  if (!tenantId) {
    return {
      kpis: EMPTY_KPIS,
      todayDeliveries: [],
      tomorrowDeliveries: [],
      monthlyChartData: [],
      dailyCollectionData: [],
      branches: [],
      isLoading: true,
      error: null,
    };
  }

  // Module T-13 (Expense Management): real monthly expense aggregation,
  // replacing the Module T-01 placeholder that always returned 0. Soft-deleted
  // expenses are already excluded by subscribeMonthExpenses' query.
  const monthlyExpenseTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const kpis = computeDashboardKpis(
    orders,
    todayPayments,
    hasNetProfitFeature,
    monthlyExpenseTotal,
    costingsByOrderId
  );
  const { today, tomorrow } = computeDeliveryHighlights(orders);
  const monthlyChartData = computeMonthlyChartSeries(orders);
  const dailyCollectionData = computeDailyCollectionSeries(monthPayments);

  return {
    kpis,
    todayDeliveries: today,
    tomorrowDeliveries: tomorrow,
    monthlyChartData,
    dailyCollectionData,
    branches,
    isLoading: !ordersLoaded,
    error,
  };
}

interface UseStaffDashboardDataResult {
  summary: StaffDashboardSummary;
  todayDeliveries: DeliveryHighlight[];
  isLoading: boolean;
  error: string | null;
}

/** Orchestrates Firestore subscriptions for the staff dashboard view. */
export function useStaffDashboardData(
  tenantId: string | null,
  staffUid: string | null,
  branchId: string | null,
  hasCommissionFeature: boolean,
  commissionRate: number
): UseStaffDashboardDataResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [costingsByOrderId, setCostingsByOrderId] = useState<Map<string, OrderCosting>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleFirestoreError = useFirestoreErrorHandler();

  useEffect(() => {
    if (!tenantId || !staffUid || !branchId) return;
    setLoaded(false);

    const notify = handleFirestoreError();
    const onError = (err: Error) => {
      setError(err.message);
      notify(err);
    };

    // branchId scoping (never "all") is required for non-admin roles per the
    // T-04-established effectiveBranchId pattern — firestore.rules'
    // canAccessBranch() denies a staff member reading orders outside their
    // own branch, so an unscoped "all" query here would previously fail with
    // permission-denied for any tenant with more than one branch.
    const unsubOrders = subscribeOrders(
      tenantId,
      branchId,
      (allOrders) => {
        setOrders(allOrders.filter((o) => o.takenByStaffId === staffUid));
        setLoaded(true);
      },
      onError
    );

    const unsubPayments = subscribeMonthPayments(
      tenantId,
      branchId,
      (allPayments) => setPayments(allPayments.filter((p) => p.collectedBy === staffUid)),
      onError
    );

    // T-12: costed-order data needed for the commission KPI. Only fetched
    // when the tenant's plan actually includes commissionSystem, to avoid
    // an unnecessary read for basic-tier tenants.
    const unsubCostings = hasCommissionFeature
      ? subscribeOrderCostingsMap(tenantId, branchId, setCostingsByOrderId, onError)
      : undefined;

    return () => {
      unsubOrders();
      unsubPayments();
      unsubCostings?.();
    };
  }, [tenantId, staffUid, branchId, hasCommissionFeature, handleFirestoreError]);

  const myCommissionThisMonth = hasCommissionFeature
    ? computeMyCommissionSummary(orders, costingsByOrderId, commissionRate, currentYearMonth()).commissionAmount
    : null;

  const summary = computeStaffSummary(orders, payments, hasCommissionFeature, myCommissionThisMonth);
  const { today } = computeDeliveryHighlights(orders);

  return { summary, todayDeliveries: today, isLoading: !loaded, error };
}
