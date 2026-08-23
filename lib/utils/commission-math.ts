import { round2 } from "@/lib/utils/calculations";
import type { Order } from "@/lib/types/order";
import type { OrderCosting } from "@/lib/types/order-costing";
import type { StaffMember } from "@/lib/types/user";
import type { CommissionSummaryRow, MyCommissionSummary } from "@/lib/types/commission";

/** yyyy-MM (locale-independent) for the current or a given date. */
export function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentYearMonth(): string {
  return toYearMonth(new Date());
}

/** Builds the last `count` yyyy-MM keys, most recent last (for month picker + charts). */
export function buildRecentYearMonths(count = 12): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(toYearMonth(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return months;
}

/**
 * yyyy-MM কে সেই মাসের শুরু ও পরের মাসের শুরু (exclusive end)-এ রূপান্তর করে —
 * Firestore date-range query-র জন্য ([start, end) সেমান্টিক্স)। audit ফিক্স
 * (১৭ আগস্ট ২০২৬): commission.ts ও expenses.ts-এ আগে "all-time ডেটা আনো,
 * ৫০০-তে ক্যাপ করো, তারপর client-side-এ মাস অনুযায়ী filter করো" প্যাটার্ন
 * ছিল — যেটা ৫০০+ সারাজীবনের অর্ডার/খরচ থাকা টেন্যান্টে পুরনো মাস সিলেক্ট
 * করলে নীরবে ভুল/অসম্পূর্ণ কমিশন-হিসাব বা খরচ-তালিকা দেখাতো (কারণ পুরনো
 * এন্ট্রি নতুনগুলোর চাপে ক্যাপ থেকে বাদ পড়ে যেত)। এখন থেকে সার্ভার-সাইডে
 * সরাসরি সিলেক্টেড মাসের রেঞ্জ দিয়ে query করা হয় — কোনো cap-এর দরকারই নেই,
 * কারণ প্রশ্নটাই এখন "এই একটা মাসে কী আছে", "সব সময়ের মধ্যে কী আছে" না।
 */
export function yearMonthToDateRange(yearMonth: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

function orderYearMonth(order: Order): string | null {
  const created = order.createdAt?.toDate?.();
  if (!created) return null;
  return toYearMonth(created);
}

/**
 * একটি নির্দিষ্ট মাসে, একজন নির্দিষ্ট স্টাফের (takenByStaffId) কস্টিং-সহ
 * অর্ডারগুলো বেছে নেয় — commission গণনার ভিত্তি।
 */
export function selectCostedOrdersForStaffMonth(
  orders: Order[],
  costingsByOrderId: Map<string, OrderCosting>,
  staffId: string,
  yearMonth: string
): { order: Order; costing: OrderCosting }[] {
  return orders
    .filter(
      (o) =>
        o.takenByStaffId === staffId &&
        o.hasCosting === true &&
        orderYearMonth(o) === yearMonth
    )
    .map((order) => {
      const costing = costingsByOrderId.get(order.id);
      return costing ? { order, costing } : null;
    })
    .filter((v): v is { order: Order; costing: OrderCosting } => v !== null);
}

/** প্রাপ্য কমিশন = (মোট বিল − মোট কস্টিং) × কমিশন হার (%) — blueprint T-12 */
export function calcCommissionAmount(
  totalBilled: number,
  totalCosting: number,
  commissionRatePercent: number
): number {
  const grossProfit = totalBilled - totalCosting;
  return round2(grossProfit * (commissionRatePercent / 100));
}

/** একজন স্টাফের একটি মাসের কমিশন সারাংশ তৈরি করে (admin/branch_manager টেবিলের একটি সারি)। */
export function buildCommissionSummaryRow(
  staff: Pick<StaffMember, "id" | "name" | "branchId" | "commissionRate">,
  matchedOrders: { order: Order; costing: OrderCosting }[]
): CommissionSummaryRow {
  const totalBilled = round2(matchedOrders.reduce((sum, m) => sum + m.order.totalAmount, 0));
  const totalCosting = round2(matchedOrders.reduce((sum, m) => sum + m.costing.totalCosting, 0));
  const grossProfit = round2(totalBilled - totalCosting);
  const commissionAmount = calcCommissionAmount(totalBilled, totalCosting, staff.commissionRate);

  return {
    staffId: staff.id,
    staffName: staff.name,
    branchId: staff.branchId,
    commissionRate: staff.commissionRate,
    costedOrderCount: matchedOrders.length,
    totalBilled,
    totalCosting,
    grossProfit,
    commissionAmount,
  };
}

/** Admin/Branch Manager কমিশন পৃষ্ঠার জন্য: প্রতিটি সক্রিয় commission_staff-এর জন্য একটি সারি। */
export function computeMonthlyCommissionSummary(
  orders: Order[],
  costingsByOrderId: Map<string, OrderCosting>,
  commissionStaff: StaffMember[],
  yearMonth: string
): CommissionSummaryRow[] {
  return commissionStaff
    .map((staff) => {
      const matched = selectCostedOrdersForStaffMonth(orders, costingsByOrderId, staff.id, yearMonth);
      return buildCommissionSummaryRow(staff, matched);
    })
    .sort((a, b) => b.commissionAmount - a.commissionAmount);
}

/**
 * নিজের কমিশন পৃষ্ঠার জন্য (commission_staff নিজে) — একটি নির্দিষ্ট মাসের সারাংশ।
 * `myOrders` ইতিমধ্যে caller-এর দিক থেকে এই স্টাফের takenByStaffId দিয়ে
 * pre-filter করা থাকে (দেখুন lib/firebase/commission.ts), তাই এখানে আলাদা
 * করে staffId ফিল্টার করার দরকার নেই — শুধু মাস ও hasCosting ফিল্টার করা হয়।
 */
export function computeMyCommissionSummary(
  myOrders: Order[],
  costingsByOrderId: Map<string, OrderCosting>,
  commissionRate: number,
  yearMonth: string
): MyCommissionSummary {
  const totalOrderCount = myOrders.filter((o) => orderYearMonth(o) === yearMonth).length;
  const costedMatched = myOrders
    .filter((o) => o.hasCosting === true && orderYearMonth(o) === yearMonth)
    .map((order) => {
      const costing = costingsByOrderId.get(order.id);
      return costing ? { order, costing } : null;
    })
    .filter((v): v is { order: Order; costing: OrderCosting } => v !== null);

  const totalBilled = round2(costedMatched.reduce((sum, m) => sum + m.order.totalAmount, 0));
  const totalCosting = round2(costedMatched.reduce((sum, m) => sum + m.costing.totalCosting, 0));
  const grossProfit = round2(totalBilled - totalCosting);
  const commissionAmount = calcCommissionAmount(totalBilled, totalCosting, commissionRate);

  return {
    month: yearMonth,
    commissionRate,
    costedOrderCount: costedMatched.length,
    totalOrderCount,
    totalBilled,
    totalCosting,
    grossProfit,
    commissionAmount,
  };
}
