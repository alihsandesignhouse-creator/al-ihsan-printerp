import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { round2 } from "@/lib/utils/calculations";
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

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Subscribes to all non-deleted orders for a tenant (optionally filtered by branch).
 * tenantId must come from the caller's auth claims — never from client input elsewhere.
 */
export function subscribeOrders(
  tenantId: string,
  branchId: string | "all",
  callback: (orders: Order[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "orders");
  const constraints = [where("deletedAt", "==", null), orderBy("expectedDeliveryDate", "asc"), limit(500)] as const;

  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const orders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
      callback(orders);
    },
    (error) => onError(error as Error)
  );
}

/** Subscribes to payments created today for a tenant (for today's collection KPI). */
export function subscribeTodayPayments(
  tenantId: string,
  branchId: string | "all",
  callback: (payments: Payment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "payments");
  const todayStart = Timestamp.fromDate(startOfDay(new Date()));
  const todayEnd = Timestamp.fromDate(endOfDay(new Date()));

  // সেশন ২ (soft-delete cascade): cascade-soft-deleted payment বাদ দিতে
  // deletedAt==null যোগ হলো — composite index (deletedAt ASC, paymentDate ASC)
  // এবং (branchId ASC, deletedAt ASC, paymentDate ASC), দেখুন firestore.indexes.json।
  const constraints = [
    where("deletedAt", "==", null),
    where("paymentDate", ">=", todayStart),
    where("paymentDate", "<=", todayEnd),
  ] as const;

  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const payments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment);
      callback(payments);
    },
    (error) => onError(error as Error)
  );
}

/** Subscribes to this month's payments for a tenant (for daily collection chart). */
export function subscribeMonthPayments(
  tenantId: string,
  branchId: string | "all",
  callback: (payments: Payment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "payments");
  const monthStart = Timestamp.fromDate(startOfMonth(new Date()));

  // সেশন ২ (soft-delete cascade): cascade-soft-deleted payment বাদ দিতে
  // deletedAt==null যোগ হলো — একই ইনডেক্স subscribeTodayPayments-এর মতো
  // পুনরায় ব্যবহৃত (deletedAt ASC, paymentDate ASC)।
  const constraints = [where("deletedAt", "==", null), where("paymentDate", ">=", monthStart)] as const;

  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const payments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment);
      callback(payments);
    },
    (error) => onError(error as Error)
  );
}

/** Subscribes to active (non-deleted, non-suspended) branches for a tenant. */
export function subscribeBranches(
  tenantId: string,
  callback: (branches: Branch[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "branches");
  const q = query(colRef, where("isActive", "==", true), orderBy("name", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const branches = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
      callback(branches);
    },
    (error) => onError(error as Error)
  );
}

/**
 * Derives dashboard KPI values from already-fetched orders + today's payments.
 *
 * ১৬ আগস্ট ২০২৬ ফিক্স: netProfit আগে শুধু (রাজস্ব − খরচ) দিয়ে হিসাব হতো —
 * উৎপাদন কস্টিং (T-11 order_costings) একেবারেই বাদ পড়ত, যদিও রিপোর্ট পেজে
 * (T-18) সঠিকভাবে "রাজস্ব − কস্টিং − খরচ" ব্যবহার হয়। এখন দুই জায়গায় একই
 * সূত্র। costingsByOrderId খালি Map পাঠালে (ফিচার বন্ধ থাকা অবস্থায়) আগের
 * আচরণের মতোই কস্টিং=০ ধরা হবে, কোনো ভাঙন হবে না।
 */
export function computeDashboardKpis(
  orders: Order[],
  todayPayments: Payment[],
  hasNetProfitFeature: boolean,
  monthlyExpenseTotal: number,
  costingsByOrderId: Map<string, OrderCosting> = new Map()
): DashboardKpis {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const totalOrders = orders.length;
  const activeOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "in_progress" || o.status === "ready"
  ).length;

  const deliveredThisMonth = orders.filter((o) => {
    if (o.status !== "delivered") return false;
    const updated = o.updatedAt?.toDate?.();
    return updated ? updated >= monthStart : false;
  }).length;

  const totalDue = round2(orders.reduce((sum, o) => sum + (o.dueAmount > 0 ? o.dueAmount : 0), 0));

  const todayCollection = round2(todayPayments.reduce((sum, p) => sum + p.amount, 0));

  const monthlyOrders = orders.filter((o) => {
    const created = o.createdAt?.toDate?.();
    return created ? created >= monthStart : false;
  });

  const monthlyRevenue = round2(monthlyOrders.reduce((sum, o) => sum + o.totalAmount, 0));

  // T-11 costing অর্ডার-ভিত্তিক (1:1, doc ID == orderId) — যেসব অর্ডারে এখনো
  // কস্টিং এন্ট্রি দেওয়া হয়নি সেগুলোর জন্য ০ ধরা হয় (get() না পেলে undefined)।
  const monthlyCostingTotal = round2(
    monthlyOrders.reduce((sum, o) => sum + (costingsByOrderId.get(o.id)?.totalCosting ?? 0), 0)
  );

  const netProfit = hasNetProfitFeature
    ? round2(monthlyRevenue - monthlyCostingTotal - monthlyExpenseTotal)
    : null;

  const monthlyExpense = hasNetProfitFeature ? round2(monthlyExpenseTotal) : null;

  return {
    totalOrders,
    activeOrders,
    deliveredThisMonth,
    totalDue,
    todayCollection,
    monthlyRevenue,
    monthlyExpense,
    netProfit,
  };
}

/**
 * Builds an order-count + revenue monthly series, most recent month last.
 * Defaults to 6 months (T-01 dashboard). T-04's customer trend tab calls
 * this with monthsBack=8 against a single customer's own order list.
 */
export function computeMonthlyChartSeries(orders: Order[], monthsBack = 6): MonthlyChartPoint[] {
  const now = new Date();
  const points: MonthlyChartPoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
    const monthLabelKey = MONTH_KEYS[target.getMonth()] ?? MONTH_KEYS[0]!;

    const matching = orders.filter((o) => {
      const created = o.createdAt?.toDate?.();
      if (!created) return false;
      return (
        created.getFullYear() === target.getFullYear() &&
        created.getMonth() === target.getMonth()
      );
    });

    points.push({
      monthKey,
      monthLabelKey,
      orderCount: matching.length,
      revenue: round2(matching.reduce((sum, o) => sum + o.totalAmount, 0)),
    });
  }

  return points;
}

/** Builds a day-by-day collection series for the current month. */
export function computeDailyCollectionSeries(payments: Payment[]): DailyCollectionPoint[] {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const byDay = new Map<number, number>();
  for (const p of payments) {
    const date = p.paymentDate?.toDate?.();
    if (!date) continue;
    const day = date.getDate();
    byDay.set(day, round2((byDay.get(day) ?? 0) + p.amount));
  }

  const points: DailyCollectionPoint[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    points.push({ day, amount: byDay.get(day) ?? 0 });
  }
  return points;
}

/** Extracts today's and tomorrow's delivery highlights from the active order list. */
export function computeDeliveryHighlights(orders: Order[]): {
  today: DeliveryHighlight[];
  tomorrow: DeliveryHighlight[];
} {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = startOfDay(tomorrow);
  const tomorrowEnd = endOfDay(tomorrow);

  const toHighlight = (o: Order): DeliveryHighlight => ({
    orderId: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    itemSummary: o.itemSummary,
    dueAmount: o.dueAmount,
    isUrgent: o.isUrgent,
    branchId: o.branchId,
  });

  const eligible = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled"
  );

  const today = eligible
    .filter((o) => {
      const date = o.expectedDeliveryDate?.toDate?.();
      return date ? date >= todayStart && date <= todayEnd : false;
    })
    .map(toHighlight);

  const tomorrowList = eligible
    .filter((o) => {
      const date = o.expectedDeliveryDate?.toDate?.();
      return date ? date >= tomorrowStart && date <= tomorrowEnd : false;
    })
    .map(toHighlight);

  return { today, tomorrow: tomorrowList };
}

/** Derives the staff-specific dashboard summary from a staff member's own orders/payments. */
export function computeStaffSummary(
  myOrders: Order[],
  myPayments: Payment[],
  hasCommissionFeature: boolean,
  myCommissionThisMonth: number | null
): StaffDashboardSummary {
  const monthStart = startOfMonth(new Date());

  const myTotalBilled = round2(myOrders.reduce((sum, o) => sum + o.totalAmount, 0));
  const myDueAmount = round2(
    myOrders.reduce((sum, o) => sum + (o.dueAmount > 0 ? o.dueAmount : 0), 0)
  );
  const myCollectionThisMonth = round2(
    myPayments
      .filter((p) => {
        const date = p.paymentDate?.toDate?.();
        return date ? date >= monthStart : false;
      })
      .reduce((sum, p) => sum + p.amount, 0)
  );

  return {
    myOrderCount: myOrders.length,
    myTotalBilled,
    myDueAmount,
    myCollectionThisMonth,
    myCommissionThisMonth: hasCommissionFeature ? myCommissionThisMonth : null,
  };
}
