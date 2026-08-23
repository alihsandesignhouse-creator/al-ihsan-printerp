// ─── রিপোর্ট ও বিশ্লেষণ — Module T-18 (স্ট্যান্ডার্ড+) ─────────────────────
//
// Blueprint অংশ ৯, T-18:
//   "আর্থিক KPI (স্ট্যান্ডার্ড+): মোট আয় − মোট কস্টিং = গ্রস মুনাফা,
//    গ্রস মুনাফা − মোট খরচ = নেট মুনাফা, মোট বকেয়া। শাখাওয়ারি KPI।
//    বিশ্লেষণ বিভাগ (স্ট্যান্ডার্ড+): আইটেম বিশ্লেষণ (শীর্ষ ৫), কাস্টমার
//    বিশ্লেষণ (শীর্ষ ৫, সর্বোচ্চ বকেয়া, নিষ্ক্রিয়), স্টাফ কর্মক্ষমতা,
//    খরচ বিশ্লেষণ (ক্যাটাগরিওয়ারি পাই চার্ট, মাসওয়ারি ট্রেন্ড)।
//    এক্সপোর্ট: Excel/PDF/CSV (প্রিমিয়াম)।"
//
// এই মডিউলে কোনো নতুন Firestore কালেকশন নেই — সবটাই বিদ্যমান
// orders/payments/expenses/order_costings/customers/users/order_items থেকে
// client-side aggregation (dashboard.ts-এর computeDashboardKpis-এর মতোই
// subscribe + compute বিভাজন প্যাটার্ন অনুসরণ করে)।

/** এই সেশনের সিদ্ধান্ত: পুরো রিপোর্ট পেজ (KPI + বিশ্লেষণ + ট্রেন্ড, সবকিছু)
 *  একই নির্বাচিত তারিখ রেঞ্জের মধ্যে সীমাবদ্ধ — একাধিক ভিন্ন রেঞ্জ একসাথে
 *  দেখানো হয় না, সরলতার জন্য (ব্যতিক্রম: সর্বোচ্চ বকেয়া/নিষ্ক্রিয় কাস্টমার,
 *  যা সংজ্ঞা অনুযায়ীই সার্বক্ষণিক/all-time হতে হয়)। */
export type ReportRangePreset = "thisMonth" | "lastMonth" | "thisYear" | "custom";

export interface ReportDateRange {
  start: Date; // inclusive, 00:00:00.000
  end: Date; // inclusive, 23:59:59.999
  preset: ReportRangePreset;
}

/** নির্বাচিত রেঞ্জের আর্থিক KPI — blueprint T-18 এর মূল সূত্র। */
export interface FinancialReportKpis {
  orderCount: number;
  totalRevenue: number; // Σ order.totalAmount (createdAt এই রেঞ্জে)
  totalCollection: number; // Σ payment.amount (paymentDate এই রেঞ্জে)
  totalCosting: number; // Σ order_costings.totalCosting (কস্টিং-সহ অর্ডার)
  grossProfit: number; // totalRevenue − totalCosting
  totalExpense: number; // Σ expense.amount (date এই রেঞ্জে)
  netProfit: number; // grossProfit − totalExpense
  totalDue: number; // এই রেঞ্জের অর্ডারগুলোর মোট বকেয়া (dueAmount > 0)
}

/** শাখাওয়ারি তুলনামূলক সারি — শুধু Tenant Admin, শাখা ১টির বেশি হলে দেখানো হয়। */
export interface BranchComparisonRow extends FinancialReportKpis {
  branchId: string;
  branchName: string;
}

export interface ItemAnalysisRow {
  itemName: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

/** item-analysis subcollection স্ক্যান সীমিত রাখার এই সেশনের সিদ্ধান্ত — দেখুন lib/firebase/reports.ts */
export interface ItemAnalysisResult {
  rows: ItemAnalysisRow[];
  isCapped: boolean;
  ordersScanned: number;
  totalOrdersInRange: number;
}

/** নির্বাচিত রেঞ্জের মধ্যে অর্ডার-ভিত্তিক কাস্টমার লিডারবোর্ড (top 5) */
export interface RangeCustomerRow {
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderCount: number;
  totalAmount: number;
}

export interface RangeCustomerLeaderboards {
  byOrderCount: RangeCustomerRow[];
  byAmount: RangeCustomerRow[];
}

/** all-time (রেঞ্জ-নিরপেক্ষ) — সর্বোচ্চ বকেয়া কাস্টমার */
export interface CustomerDueRow {
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalDue: number;
}

/** all-time — নিষ্ক্রিয় কাস্টমার (গত N দিনে কোনো অর্ডার নেই) */
export interface InactiveCustomerRow {
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastOrderDate: Date | null; // null = কখনো অর্ডার করেননি
  daysSinceLastOrder: number | null;
}

export const INACTIVE_CUSTOMER_THRESHOLD_DAYS = 60;

export interface StaffPerformanceRow {
  staffId: string;
  staffName: string;
  branchId: string | null;
  orderCount: number;
  totalRevenue: number;
  totalCollection: number;
  /** null = commission_staff নয়, বা commissionSystem ফিচার নেই */
  commissionAmount: number | null;
}

export interface ExpenseCategorySlice {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number; // 0-100, round(1)
}

export interface ExpenseMonthlyTrendPoint {
  monthKey: string; // "2026-01"
  monthLabelKey: string; // "months.jan"
  amount: number;
}
