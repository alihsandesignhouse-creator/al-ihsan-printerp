import type { Timestamp } from "firebase/firestore";

/** Order lifecycle status */
export type OrderStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "delivered"
  | "cancelled";

export type PaymentMethod =
  | "cash"
  | "bkash"
  | "nagad"
  | "rocket"
  | "bank"
  | "cheque";

export type DiscountType = "amount" | "percent";

/** /tenants/{tenantId}/branches/{branchId} */
export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  phone: string | null;
  branchManagerId: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** /tenants/{tenantId}/orders/{orderId} */
export interface Order {
  id: string;
  tenantId: string;
  branchId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  itemSummary: string;
  status: OrderStatus;
  expectedDeliveryDate: Timestamp;
  assignedStaffId: string | null;
  takenByStaffId: string;
  isUrgent: boolean;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  adjustment: number;
  adjustmentNote: string;
  totalAmount: number;
  advanceAmount: number;
  advanceMethod: PaymentMethod | null;
  dueAmount: number;
  notes: string;
  createdBy: string;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  /** স্বয়ংক্রিয়ভাবে true হয় যখন order_costings/{orderId} প্রথমবার সেভ হয় (T-11)। পুরনো অর্ডারে undefined = কস্টিং নেই। */
  hasCosting?: boolean;
  /** AUDIT-REPORT-5.md Issue #1 fix: recordPayment()-এর সর্বশেষ payment ডকুমেন্টের ID — firestore.rules staff-branch dueAmount-হ্রাস rule-এ getAfter() দিয়ে payment linkage যাচাইয়ের জন্য। শুধু staff-এর write-এ প্রাসঙ্গিক; admin/branch_manager write-এ harmless। */
  lastPaymentId?: string;
  /**
   * ডেলিভারির প্রকৃত তারিখ (১২ আগস্ট ২০২৬ যোগ হলো) — expectedDeliveryDate
   * (প্রত্যাশিত/প্রাথমিক তারিখ) থেকে আলাদা। দুটো পথে বসে:
   *  ১) createOrder()-এ "সরাসরি ডেলিভারড হিসেবে সেভ করুন" টগল চেক করলে
   *     ব্যবহারকারীর দেওয়া (আজ/অতীত) তারিখ,
   *  ২) স্বাভাবিক ফ্লো-তে updateOrderStatus() যখন status 'delivered'-এ
   *     পরিবর্তিত হয়, তখন সার্ভার টাইমস্ট্যাম্প।
   * undefined = কখনো ডেলিভার হয়নি, অথবা এই ফিচার আসার আগে ডেলিভার হয়েছিল
   * (পুরনো অর্ডারে এই ফিল্ড নেই — কোথাও ধরে নেওয়া চলবে না যে এটা সবসময় আছে)।
   */
  deliveredAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** /tenants/{tenantId}/payments/{paymentId} */
export interface Payment {
  id: string;
  tenantId: string;
  branchId: string;
  orderId: string;
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  collectedBy: string;
  paymentDate: Timestamp;
  notes: string;
  createdAt: Timestamp;
  /**
   * ৩১ জুলাই ২০২৬ সেশন (audit #৩, /dashboard/payments): denormalized from
   * the order at the moment recordPayment() writes this doc — same
   * precedent as Order.customerName/customerPhone (no extra read needed,
   * the transaction already has the order loaded). Optional because
   * payments recorded before this session don't have them; the payments
   * list page falls back to showing the raw orderId in that case.
   */
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  /**
   * ইউজার-ফিডব্যাক সেশন ২ (soft-delete cascade): অর্ডার সফট-ডিলিট হলে
   * softDeleteOrder() একই transaction-এ সংশ্লিষ্ট প্রতিটা payment
   * ডকুমেন্টেও deletedAt/deletedBy বসায় — orderNumber/customerName-এর মতোই
   * ঐচ্ছিক (ব্যাকওয়ার্ড-কম্প্যাটিবল), কারণ এই সেশনের আগে রেকর্ড হওয়া সব
   * payment ডকুমেন্টে এই ফিল্ড নেই। scripts/backfill-payments-deleted-at.js
   * সব পুরনো ডকুমেন্টে deletedAt: null ব্যাকফিল করে — নাহলে
   * where("deletedAt","==",null) কুয়েরি সেগুলো বাদ দিয়ে দেবে (ডেটা হঠাৎ
   * উধাও দেখাবে)। হার্ড-ডিলিট নয় — প্রজেক্টের নিয়ম "soft delete only"।
   */
  deletedAt?: Timestamp | null;
  deletedBy?: string | null;
}

/** Aggregated KPI values shown on the dashboard */
export interface DashboardKpis {
  totalOrders: number;
  activeOrders: number;
  deliveredThisMonth: number;
  totalDue: number;
  todayCollection: number;
  monthlyRevenue: number;
  monthlyExpense: number | null; // null when plan does not include expense/profit reporting
  netProfit: number | null; // null when plan does not include profit reporting
}

/** A single point used to render the monthly orders / revenue charts */
export interface MonthlyChartPoint {
  monthKey: string; // e.g. "2026-01"
  monthLabelKey: string; // i18n key, e.g. "months.jan"
  orderCount: number;
  revenue: number;
}

/** A single point used to render the current-month daily collection chart */
export interface DailyCollectionPoint {
  day: number; // day of month, 1-31
  amount: number;
}

/** Minimal delivery item shown in Today / Tomorrow delivery lists */
export interface DeliveryHighlight {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  itemSummary: string;
  dueAmount: number;
  isUrgent: boolean;
  branchId: string;
}

/** Staff-specific dashboard summary (T-19 preview used on T-01 staff view) */
export interface StaffDashboardSummary {
  myOrderCount: number;
  myTotalBilled: number;
  myDueAmount: number;
  myCollectionThisMonth: number;
  myCommissionThisMonth: number | null;
}
