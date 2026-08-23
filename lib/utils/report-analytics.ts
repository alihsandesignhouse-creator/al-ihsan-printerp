import { round2 } from "@/lib/utils/calculations";
import type { Order, Payment, Branch } from "@/lib/types/dashboard";
import type { OrderCosting } from "@/lib/types/order-costing";
import type { Expense } from "@/lib/types/expense";
import type { Customer, OrderItem } from "@/lib/types/order";
import type { StaffMember } from "@/lib/types/user";
import type { CustomerFinancialSummary } from "@/lib/types/customer";
import type {
  FinancialReportKpis,
  BranchComparisonRow,
  ItemAnalysisRow,
  RangeCustomerRow,
  RangeCustomerLeaderboards,
  CustomerDueRow,
  InactiveCustomerRow,
  StaffPerformanceRow,
  ExpenseCategorySlice,
  ExpenseMonthlyTrendPoint,
} from "@/lib/types/report";
import { INACTIVE_CUSTOMER_THRESHOLD_DAYS } from "@/lib/types/report";
import { calcCommissionAmount } from "@/lib/utils/commission-math";

const MONTH_KEYS = [
  "months.jan",
  "months.feb",
  "months.mar",
  "months.apr",
  "months.may",
  "months.jun",
  "months.jul",
  "months.aug",
  "months.sep",
  "months.oct",
  "months.nov",
  "months.dec",
] as const;

// ─── আর্থিক KPI (blueprint T-18) ────────────────────────────────────────────

function totalCostingFor(orders: Order[], costingsByOrderId: Map<string, OrderCosting>): number {
  return round2(
    orders.reduce((sum, o) => {
      if (!o.hasCosting) return sum;
      const costing = costingsByOrderId.get(o.id);
      return costing ? sum + costing.totalCosting : sum;
    }, 0)
  );
}

/** নির্বাচিত রেঞ্জের জন্য মূল আর্থিক KPI — মোট আয়, কস্টিং, গ্রস মুনাফা, খরচ, নেট মুনাফা, বকেয়া। */
export function computeFinancialKpis(
  orders: Order[],
  payments: Payment[],
  costingsByOrderId: Map<string, OrderCosting>,
  expenses: Expense[]
): FinancialReportKpis {
  const totalRevenue = round2(orders.reduce((sum, o) => sum + o.totalAmount, 0));
  const totalCollection = round2(payments.reduce((sum, p) => sum + p.amount, 0));
  const totalCosting = totalCostingFor(orders, costingsByOrderId);
  const grossProfit = round2(totalRevenue - totalCosting);
  const totalExpense = round2(expenses.reduce((sum, e) => sum + e.amount, 0));
  const netProfit = round2(grossProfit - totalExpense);
  const totalDue = round2(orders.reduce((sum, o) => sum + (o.dueAmount > 0 ? o.dueAmount : 0), 0));

  return {
    orderCount: orders.length,
    totalRevenue,
    totalCollection,
    totalCosting,
    grossProfit,
    totalExpense,
    netProfit,
    totalDue,
  };
}

/** শাখাওয়ারি তুলনা — শুধু Tenant Admin ("সব শাখা" নির্বাচিত থাকলে) দেখেন, blueprint T-18। */
export function computeBranchComparison(
  orders: Order[],
  payments: Payment[],
  costingsByOrderId: Map<string, OrderCosting>,
  expenses: Expense[],
  branches: Branch[]
): BranchComparisonRow[] {
  return branches
    .map((branch) => {
      const branchOrders = orders.filter((o) => o.branchId === branch.id);
      const branchPayments = payments.filter((p) => p.branchId === branch.id);
      const branchExpenses = expenses.filter((e) => e.branchId === branch.id);
      const kpis = computeFinancialKpis(branchOrders, branchPayments, costingsByOrderId, branchExpenses);
      return { branchId: branch.id, branchName: branch.name, ...kpis };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ─── আইটেম বিশ্লেষণ (order_items, top 5) ───────────────────────────────────

export function computeItemAnalysis(items: OrderItem[], top = 5): ItemAnalysisRow[] {
  const byName = new Map<string, { itemName: string; orderIds: Set<string>; totalQuantity: number; totalRevenue: number }>();

  for (const item of items) {
    const key = item.itemName.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key) ?? {
      itemName: item.itemName.trim(),
      orderIds: new Set<string>(),
      totalQuantity: 0,
      totalRevenue: 0,
    };
    existing.orderIds.add(item.orderId);
    existing.totalQuantity += item.quantity;
    existing.totalRevenue = round2(existing.totalRevenue + item.lineTotal);
    byName.set(key, existing);
  }

  return Array.from(byName.values())
    .map((v) => ({
      itemName: v.itemName,
      orderCount: v.orderIds.size,
      totalQuantity: v.totalQuantity,
      totalRevenue: v.totalRevenue,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, top);
}

// ─── কাস্টমার বিশ্লেষণ ──────────────────────────────────────────────────────

/** নির্বাচিত রেঞ্জের অর্ডার থেকে top-5 কাস্টমার (অর্ডার সংখ্যা ও টাকার অঙ্ক অনুযায়ী)। */
export function computeRangeCustomerLeaderboards(orders: Order[], top = 5): RangeCustomerLeaderboards {
  const byCustomer = new Map<string, RangeCustomerRow>();

  for (const order of orders) {
    const existing = byCustomer.get(order.customerId) ?? {
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderCount: 0,
      totalAmount: 0,
    };
    existing.orderCount += 1;
    existing.totalAmount = round2(existing.totalAmount + order.totalAmount);
    byCustomer.set(order.customerId, existing);
  }

  const rows = Array.from(byCustomer.values());
  return {
    byOrderCount: [...rows].sort((a, b) => b.orderCount - a.orderCount).slice(0, top),
    byAmount: [...rows].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, top),
  };
}

/** all-time (রেঞ্জ-নিরপেক্ষ) — সর্বোচ্চ বকেয়া কাস্টমার, blueprint T-18: "সর্বোচ্চ বকেয়া"। */
export function computeTopDueCustomers(
  allTimeFinancials: Map<string, CustomerFinancialSummary>,
  customers: Customer[],
  top = 5
): CustomerDueRow[] {
  return customers
    .map((customer) => {
      const summary = allTimeFinancials.get(customer.id);
      return summary && summary.totalDue > 0
        ? { customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, totalDue: summary.totalDue }
        : null;
    })
    .filter((v): v is CustomerDueRow => v !== null)
    .sort((a, b) => b.totalDue - a.totalDue)
    .slice(0, top);
}

/** all-time — নিষ্ক্রিয় কাস্টমার (গত ৬০ দিনে কোনো অর্ডার নেই, বা কখনোই নেই)। */
export function computeInactiveCustomers(
  allOrders: Order[],
  customers: Customer[],
  thresholdDays = INACTIVE_CUSTOMER_THRESHOLD_DAYS,
  top = 5
): InactiveCustomerRow[] {
  const lastOrderByCustomer = new Map<string, Date>();
  for (const order of allOrders) {
    const created = order.createdAt?.toDate?.();
    if (!created) continue;
    const existing = lastOrderByCustomer.get(order.customerId);
    if (!existing || created > existing) lastOrderByCustomer.set(order.customerId, created);
  }

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;

  return customers
    .map((customer) => {
      const lastOrderDate = lastOrderByCustomer.get(customer.id) ?? null;
      const daysSinceLastOrder = lastOrderDate
        ? Math.floor((now.getTime() - lastOrderDate.getTime()) / msPerDay)
        : null;
      return { customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, lastOrderDate, daysSinceLastOrder };
    })
    .filter((row) => row.daysSinceLastOrder === null || row.daysSinceLastOrder >= thresholdDays)
    .sort((a, b) => {
      // কখনো অর্ডার করেননি এমন কাস্টমার সবার আগে, তারপর সবচেয়ে বেশিদিন নিষ্ক্রিয় যিনি।
      if (a.daysSinceLastOrder === null && b.daysSinceLastOrder === null) return 0;
      if (a.daysSinceLastOrder === null) return -1;
      if (b.daysSinceLastOrder === null) return 1;
      return b.daysSinceLastOrder - a.daysSinceLastOrder;
    })
    .slice(0, top);
}

// ─── স্টাফ কর্মক্ষমতা ───────────────────────────────────────────────────────

/** নির্বাচিত রেঞ্জের প্রতিটি স্টাফের অর্ডার/আয়/কালেকশন/কমিশন — blueprint T-18: "স্টাফ কর্মক্ষমতা"। */
export function computeStaffPerformance(
  orders: Order[],
  payments: Payment[],
  costingsByOrderId: Map<string, OrderCosting>,
  staffMembers: StaffMember[],
  hasCommissionFeature: boolean
): StaffPerformanceRow[] {
  return staffMembers
    .map((staff) => {
      const myOrders = orders.filter((o) => o.takenByStaffId === staff.id);
      const myPayments = payments.filter((p) => p.collectedBy === staff.id);

      const totalRevenue = round2(myOrders.reduce((sum, o) => sum + o.totalAmount, 0));
      const totalCollection = round2(myPayments.reduce((sum, p) => sum + p.amount, 0));

      let commissionAmount: number | null = null;
      if (hasCommissionFeature && staff.role === "commission_staff") {
        const costedOrders = myOrders.filter((o) => o.hasCosting === true);
        const costedTotalBilled = round2(costedOrders.reduce((sum, o) => sum + o.totalAmount, 0));
        const costedTotalCosting = totalCostingFor(costedOrders, costingsByOrderId);
        commissionAmount = calcCommissionAmount(costedTotalBilled, costedTotalCosting, staff.commissionRate);
      }

      return {
        staffId: staff.id,
        staffName: staff.name,
        branchId: staff.branchId,
        orderCount: myOrders.length,
        totalRevenue,
        totalCollection,
        commissionAmount,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ─── খরচ বিশ্লেষণ ───────────────────────────────────────────────────────────

/** ক্যাটাগরিওয়ারি খরচ বিভাজন (পাই চার্টের জন্য) — categoryId/categoryName অপরিবর্তিত রাখা হয়,
 *  'স্টাফ পেমেন্ট'-এর t()-ভিত্তিক লেবেল রেন্ডার কম্পোনেন্টের দায়িত্ব (ExpenseListTable-এর সাথে সামঞ্জস্যপূর্ণ)। */
export function computeExpenseCategoryBreakdown(expenses: Expense[]): ExpenseCategorySlice[] {
  const byCategory = new Map<string, { categoryId: string; categoryName: string; amount: number }>();
  for (const expense of expenses) {
    const existing = byCategory.get(expense.categoryId) ?? {
      categoryId: expense.categoryId,
      categoryName: expense.categoryName,
      amount: 0,
    };
    existing.amount = round2(existing.amount + expense.amount);
    byCategory.set(expense.categoryId, existing);
  }

  const total = Array.from(byCategory.values()).reduce((sum, v) => sum + v.amount, 0);

  return Array.from(byCategory.values())
    .map((v) => ({
      ...v,
      percentage: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * মাসওয়ারি খরচ ট্রেন্ড — এই সেশনের সিদ্ধান্ত: নির্বাচিত রেঞ্জের ভেতরেই মাস
 * বাকেট করা হয় (রেঞ্জ-নিরপেক্ষ আলাদা "গত ৬ মাস" উইন্ডো নয়) — একই রেঞ্জ পুরো
 * পেজ জুড়ে সামঞ্জস্যপূর্ণ রাখতে (দেখুন lib/types/report.ts শীর্ষ মন্তব্য)।
 * "এই মাস" রেঞ্জে স্বাভাবিকভাবেই একটি মাত্র বাকেট দেখাবে।
 */
export function computeExpenseMonthlyTrend(expenses: Expense[]): ExpenseMonthlyTrendPoint[] {
  const byMonth = new Map<string, number>();
  for (const expense of expenses) {
    const date = expense.date?.toDate?.();
    if (!date) continue;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(monthKey, round2((byMonth.get(monthKey) ?? 0) + expense.amount));
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([monthKey, amount]) => {
      const monthIndex = Number(monthKey.split("-")[1]) - 1;
      return { monthKey, monthLabelKey: MONTH_KEYS[monthIndex] ?? MONTH_KEYS[0]!, amount };
    });
}
