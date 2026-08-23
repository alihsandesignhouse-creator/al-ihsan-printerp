/**
 * lib/constants/status-colors.ts
 *
 * ডিজাইন-সিস্টেম কালার অডিট (৮ আগস্ট ২০২৬) — এতদিন প্রতিটা স্ট্যাটাস-ব্যাজ
 * কম্পোনেন্ট (Order, Quotation, Tenant, Staff role, Withdrawal, Outsource,
 * Supplier-transaction, Stock-transaction, ইত্যাদি) নিজে নিজে তার নিজস্ব
 * `STATUS_CLASSES`/`TYPE_CLASSES` কনস্ট্যান্ট সংজ্ঞায়িত করতো — কমপক্ষে ১৩টা
 * আলাদা ফাইলে ছড়ানো ছিল। এখন সবগুলো এই একটা ফাইলে — কোনো স্ট্যাটাসের রং
 * বদলাতে হলে এখন থেকে এই ফাইলটাই একমাত্র জায়গা।
 *
 * প্রতিটা ডোমেইন (Order status, Quotation status, ইত্যাদি) নিজস্ব, আলাদা
 * অর্থবহ enum — এগুলো একটা জেনেরিক এনামে মার্জ করা হয়নি (সেটা ভুল হতো,
 * কারণ এগুলো আসলেই আলাদা আলাদা জিনিস বোঝায়), শুধু এক ফাইলে *সহাবস্থান*
 * করছে যাতে এক জায়গা থেকে সবকিছু দেখা ও এডিট করা যায়।
 *
 * সব মান ব্লুপ্রিন্টের অংশ ১৪.৬-এর Status Badge স্পেসিফিকেশনের সাথে হুবহু
 * মিলিয়ে রাখা হয়েছে (এই সেশনের অডিটে যাচাই করে কোনো value-drift পাওয়া
 * যায়নি, তাই মানগুলো অপরিবর্তিত রাখা হয়েছে — শুধু জায়গা বদলেছে)।
 */

import type { OrderStatus } from "@/lib/types/order";
import type { QuotationStatus } from "@/lib/types/quotation";
import type { StaffRole } from "@/lib/types/user";
import type { WithdrawalStatus } from "@/lib/types/commission";
import type { SubscriptionStatus } from "@/lib/types/tenant";
import type { OutsourceStatus } from "@/lib/types/outsource";
import type { SupplierTransactionType } from "@/lib/types/supplier";
import type { StockTransactionType } from "@/lib/types/stock";

/** T-02 অর্ডার স্ট্যাটাস — ব্লুপ্রিন্ট ১৪.৬-এর সাথে মেলে। */
export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  pending: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

/** T-14 কোটেশন স্ট্যাটাস। */
export const QUOTATION_STATUS_CLASSES: Record<QuotationStatus, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

/** SA-02 টেন্যান্ট সাবস্ক্রিপশন স্ট্যাটাস — ব্লুপ্রিন্ট ১৪.৬-এর সাথে মেলে। */
export const TENANT_STATUS_CLASSES: Record<SubscriptionStatus, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-purple-100 text-purple-700",
  expired: "bg-red-100 text-red-700",
  suspended: "bg-amber-100 text-amber-700",
};

/** SA-02 টেন্যান্টের প্যাকেজ ব্যাজ। */
export const PLAN_BADGE_CLASSES: Record<string, string> = {
  basic: "bg-neutral-100 text-neutral-700",
  standard: "bg-blue-100 text-blue-700",
  premium: "bg-amber-100 text-amber-700",
};
export const PLAN_BADGE_FALLBACK_CLASS = "bg-neutral-100 text-neutral-700";

/** T-07 স্টাফ রোল ব্যাজ (tenant_admin এই তালিকায় নেই — সে কখনো "স্টাফ" হিসেবে ব্যাজ পায় না)। */
export const ROLE_BADGE_CLASSES: Record<StaffRole, string> = {
  branch_manager: "bg-blue-100 text-blue-700",
  commission_staff: "bg-amber-100 text-amber-700",
  regular_staff: "bg-neutral-100 text-neutral-600",
};
export const ROLE_BADGE_FALLBACK_CLASS = "bg-neutral-100 text-neutral-600";

/** T-07 স্টাফ সক্রিয়/নিষ্ক্রিয় ব্যাজ (২-স্টেট)। */
export const STAFF_ACTIVE_CLASS = "bg-green-100 text-green-700";
export const STAFF_INACTIVE_CLASS = "bg-neutral-100 text-neutral-500";

/** T-12 স্টাফ উত্তোলন অনুরোধ স্ট্যাটাস। */
export const WITHDRAWAL_STATUS_CLASSES: Record<WithdrawalStatus, string> = {
  pending: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
};

/** T-17 আউটসোর্স রেকর্ড স্ট্যাটাস। */
export const OUTSOURCE_STATUS_CLASSES: Record<OutsourceStatus, string> = {
  sent: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  returned: "bg-green-100 text-green-800",
};

/** T-16 সাপ্লায়ার লেনদেনের ধরন। */
export const SUPPLIER_TRANSACTION_CLASSES: Record<SupplierTransactionType, string> = {
  purchase: "bg-amber-100 text-amber-700",
  payment: "bg-emerald-100 text-emerald-700",
};

/** T-15 স্টক লেনদেনের ধরন। */
export const STOCK_TRANSACTION_CLASSES: Record<StockTransactionType, string> = {
  in: "bg-emerald-100 text-emerald-700",
  out: "bg-amber-100 text-amber-700",
  adjustment: "bg-blue-100 text-blue-700",
};

/** T-08 লগইন-ইতিহাসে লগইন/লগআউট আইকন ব্যাকগ্রাউন্ড (২-স্টেট)। */
export const LOGIN_EVENT_CLASS = "bg-emerald-100 text-emerald-700";
export const LOGOUT_EVENT_CLASS = "bg-neutral-100 text-neutral-500";

/** SA-03 প্যাকেজের কুপন/ফিচার সক্রিয়/নিষ্ক্রিয় ব্যাজ (২-স্টেট)। */
export const ACTIVE_BADGE_CLASS = "bg-emerald-100 text-emerald-700";
export const INACTIVE_BADGE_CLASS = "bg-neutral-100 text-neutral-500";
