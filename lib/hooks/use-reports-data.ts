"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeOrdersInRange,
  subscribePaymentsInRange,
  subscribeExpensesInRange,
  fetchOrderItemsForOrders,
} from "@/lib/firebase/reports";
import { subscribeOrderCostingsMap } from "@/lib/firebase/commission";
import { subscribeStaffMembers } from "@/lib/firebase/users";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeCustomers, subscribeOrdersForFinancials, aggregateCustomerFinancials } from "@/lib/firebase/customers";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import {
  computeFinancialKpis,
  computeBranchComparison,
  computeRangeCustomerLeaderboards,
  computeTopDueCustomers,
  computeInactiveCustomers,
  computeStaffPerformance,
  computeExpenseCategoryBreakdown,
  computeExpenseMonthlyTrend,
} from "@/lib/utils/report-analytics";
import type { Order, Payment, Branch } from "@/lib/types/dashboard";
import type { OrderCosting } from "@/lib/types/order-costing";
import type { Expense } from "@/lib/types/expense";
import type { StaffMember } from "@/lib/types/user";
import type { Customer } from "@/lib/types/order";
import type {
  ReportDateRange,
  FinancialReportKpis,
  BranchComparisonRow,
  ItemAnalysisResult,
  RangeCustomerLeaderboards,
  CustomerDueRow,
  InactiveCustomerRow,
  StaffPerformanceRow,
  ExpenseCategorySlice,
  ExpenseMonthlyTrendPoint,
} from "@/lib/types/report";

const MAX_ITEM_ANALYSIS_ORDERS = 300;

const EMPTY_ITEM_ANALYSIS: ItemAnalysisResult = { rows: [], isCapped: false, ordersScanned: 0, totalOrdersInRange: 0 };

interface UseReportsDataResult {
  kpis: FinancialReportKpis;
  branchComparison: BranchComparisonRow[];
  itemAnalysis: ItemAnalysisResult;
  itemAnalysisLoading: boolean;
  rangeCustomerLeaderboards: RangeCustomerLeaderboards;
  topDueCustomers: CustomerDueRow[];
  inactiveCustomers: InactiveCustomerRow[];
  staffPerformance: StaffPerformanceRow[];
  expenseCategoryBreakdown: ExpenseCategorySlice[];
  expenseMonthlyTrend: ExpenseMonthlyTrendPoint[];
  branches: Branch[];
  orders: Order[];
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
}

const EMPTY_KPIS: FinancialReportKpis = {
  orderCount: 0,
  totalRevenue: 0,
  totalCollection: 0,
  totalCosting: 0,
  grossProfit: 0,
  totalExpense: 0,
  netProfit: 0,
  totalDue: 0,
};

/**
 * T-18 রিপোর্ট পেজের সব Firestore subscription orchestrate করে এবং
 * client-side aggregation করে — dashboard.ts (use-dashboard-data.ts)-এর
 * subscribe+compute বিভাজন প্যাটার্নের সমান্তরাল। `hasAdvancedReports` false
 * হলে কোনো subscription শুরু হয় না (basic-tier তেন্যান্টের জন্য অপ্রয়োজনীয়
 * read এড়ানো হয়) — পেজ কম্পোনেন্ট নিজেই LockedFeatureNotice দেখায়।
 */
export function useReportsData(
  tenantId: string | null,
  branchId: string | "all",
  range: ReportDateRange,
  hasAdvancedReports: boolean,
  hasCommissionFeature: boolean
): UseReportsDataResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [costingsByOrderId, setCostingsByOrderId] = useState<Map<string, OrderCosting>>(new Map());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allOrdersForFinancials, setAllOrdersForFinancials] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleFirestoreError = useFirestoreErrorHandler();

  const [itemAnalysis, setItemAnalysis] = useState<ItemAnalysisResult>(EMPTY_ITEM_ANALYSIS);
  const [itemAnalysisLoading, setItemAnalysisLoading] = useState(false);

  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  useEffect(() => {
    if (!tenantId || !hasAdvancedReports) return;
    setOrdersLoaded(false);

    const notify = handleFirestoreError();
    const onError = (err: Error) => {
      setError(err.message);
      notify(err);
    };

    const unsubOrders = subscribeOrdersInRange(
      tenantId,
      branchId,
      new Date(startMs),
      new Date(endMs),
      (data) => {
        setOrders(data);
        setOrdersLoaded(true);
      },
      onError
    );

    const unsubPayments = subscribePaymentsInRange(
      tenantId,
      branchId,
      new Date(startMs),
      new Date(endMs),
      setPayments,
      onError
    );

    const unsubExpenses = subscribeExpensesInRange(
      tenantId,
      branchId,
      new Date(startMs),
      new Date(endMs),
      setExpenses,
      onError
    );

    const unsubCostings = subscribeOrderCostingsMap(tenantId, branchId, setCostingsByOrderId, onError);

    const unsubBranches = subscribeBranches(tenantId, setBranches, onError);
    const unsubStaff = subscribeStaffMembers(tenantId, branchId, setStaffMembers, onError);
    const unsubCustomers = subscribeCustomers(tenantId, setCustomers, onError);
    const unsubAllOrders = subscribeOrdersForFinancials(tenantId, branchId, setAllOrdersForFinancials, onError);

    return () => {
      unsubOrders();
      unsubPayments();
      unsubExpenses();
      unsubCostings();
      unsubBranches();
      unsubStaff();
      unsubCustomers();
      unsubAllOrders();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchId, hasAdvancedReports, startMs, endMs, handleFirestoreError]);

  // আইটেম বিশ্লেষণ: real-time নয়, একবার fetch (subcollection-per-order স্ক্যান
  // ব্যয়বহুল বলে) — অর্ডার সেট (id ভিত্তিক) পরিবর্তিত হলেই পুনরায় চলে।
  const orderIdsKey = useMemo(() => orders.map((o) => o.id).sort().join(","), [orders]);

  useEffect(() => {
    if (!tenantId || !hasAdvancedReports || orders.length === 0) {
      setItemAnalysis(EMPTY_ITEM_ANALYSIS);
      return;
    }
    let cancelled = false;
    setItemAnalysisLoading(true);
    fetchOrderItemsForOrders(tenantId, orders, MAX_ITEM_ANALYSIS_ORDERS)
      .then((result) => {
        if (!cancelled) setItemAnalysis(result);
      })
      .catch(() => {
        if (!cancelled) setItemAnalysis(EMPTY_ITEM_ANALYSIS);
      })
      .finally(() => {
        if (!cancelled) setItemAnalysisLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, hasAdvancedReports, orderIdsKey]);

  if (!tenantId || !hasAdvancedReports) {
    return {
      kpis: EMPTY_KPIS,
      branchComparison: [],
      itemAnalysis: EMPTY_ITEM_ANALYSIS,
      itemAnalysisLoading: false,
      rangeCustomerLeaderboards: { byOrderCount: [], byAmount: [] },
      topDueCustomers: [],
      inactiveCustomers: [],
      staffPerformance: [],
      expenseCategoryBreakdown: [],
      expenseMonthlyTrend: [],
      branches: [],
      orders: [],
      expenses: [],
      isLoading: false,
      error: null,
    };
  }

  const kpis = computeFinancialKpis(orders, payments, costingsByOrderId, expenses);
  const branchComparison = computeBranchComparison(orders, payments, costingsByOrderId, expenses, branches);
  const rangeCustomerLeaderboards = computeRangeCustomerLeaderboards(orders);
  const allTimeFinancials = aggregateCustomerFinancials(allOrdersForFinancials);
  const topDueCustomers = computeTopDueCustomers(allTimeFinancials, customers);
  const inactiveCustomers = computeInactiveCustomers(allOrdersForFinancials, customers);
  const staffPerformance = computeStaffPerformance(orders, payments, costingsByOrderId, staffMembers, hasCommissionFeature);
  const expenseCategoryBreakdown = computeExpenseCategoryBreakdown(expenses);
  const expenseMonthlyTrend = computeExpenseMonthlyTrend(expenses);

  return {
    kpis,
    branchComparison,
    itemAnalysis,
    itemAnalysisLoading,
    rangeCustomerLeaderboards,
    topDueCustomers,
    inactiveCustomers,
    staffPerformance,
    expenseCategoryBreakdown,
    expenseMonthlyTrend,
    branches,
    orders,
    expenses,
    isLoading: !ordersLoaded,
    error,
  };
}
