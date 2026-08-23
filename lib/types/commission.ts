import type { Timestamp } from "firebase/firestore";

// ─── Staff Commission System — Module T-12 (স্ট্যান্ডার্ড+) ────────────────
//
// প্রাপ্য কমিশন = (মোট বিল − মোট কস্টিং) × কমিশন হার (%)
// শুধুমাত্র COMMISSION_STAFF রোলের জন্য প্রযোজ্য (এই সেশনে নিশ্চিত করা হয়েছে),
// এবং শুধুমাত্র কস্টিং-সহ অর্ডার (order.hasCosting === true) গণনায় ধরা হয় —
// blueprint অংশ ৯ / T-11-T-12: "কস্টিং ছাড়া অর্ডার আলাদাভাবে চিহ্নিত। কমিশন
// হিসাবে শুধু কস্টিং-সহ অর্ডার।"
//
// মাস নির্ধারণ হয় order.createdAt দিয়ে (এই সেশনে নিশ্চিত করা সিদ্ধান্ত)।

export type WithdrawalType = "commission" | "salary" | "advance" | "other";

export const WITHDRAWAL_TYPES: WithdrawalType[] = [
  "commission",
  "salary",
  "advance",
  "other",
];

export type WithdrawalStatus = "pending" | "approved" | "rejected";

/**
 * /tenants/{tenantId}/staff_withdrawals/{withdrawalId}
 *
 * Blueprint T-12: "উত্তোলন স্বয়ংক্রিয়ভাবে 'স্টাফ পেমেন্ট' ক্যাটাগরিতে Expense
 * যোগ" — T-13 (খরচ ব্যবস্থাপনা) সেশনে সংযুক্ত হয়েছে (lib/firebase/commission.ts:
 * processWithdrawal, approve path)। একটি অনুমোদিত withdrawal সবসময় ঠিক একটি
 * expense তৈরি করে, একই transaction-এ atomic — `Expense.sourceWithdrawalId`
 * দিয়ে ট্রেস করা যায়।
 */
export interface StaffWithdrawal {
  id: string;
  tenantId: string;
  branchId: string;
  staffId: string;
  staffName: string;
  type: WithdrawalType;
  /** যে মাসের কমিশনের বিপরীতে আবেদন — "commission" টাইপ ছাড়া খালি স্ট্রিং। ফরম্যাট: yyyy-MM */
  month: string;
  /** স্টাফের আবেদন করা মূল পরিমাণ — অনুমোদনের পরও অপরিবর্তিত থাকে (অডিট ট্রেইলের জন্য)। */
  requestedAmount: number;
  /** চূড়ান্ত অনুমোদিত পরিমাণ — pending অবস্থায় requestedAmount-এর সমান। */
  amount: number;
  note: string;
  status: WithdrawalStatus;
  requestedBy: string;
  requestedAt: Timestamp;
  processedBy: string | null;
  processedByName: string | null;
  processedAt: Timestamp | null;
  adminNote: string;
  /** blueprint T-12: "অ্যাডমিন সম্পাদনা করলে edited_by_admin: true" */
  editedByAdmin: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WithdrawalRequestFormData {
  type: WithdrawalType;
  month: string; // "" allowed for non-commission types
  amount: number;
  note: string;
}

export interface ProcessWithdrawalInput {
  action: "approve" | "reject";
  /** null রাখলে requestedAmount অপরিবর্তিত থাকবে — শুধু পরিবর্তিত হলে editedByAdmin: true হয়। */
  adjustedAmount: number | null;
  adminNote: string;
}

/** মাসওয়ারি কমিশন সারাংশ টেবিলের একটি সারি (T-12, admin/branch_manager ভিউ) */
export interface CommissionSummaryRow {
  staffId: string;
  staffName: string;
  branchId: string | null;
  commissionRate: number;
  costedOrderCount: number;
  totalBilled: number;
  totalCosting: number;
  grossProfit: number;
  commissionAmount: number;
}

/** নির্বাচিত মাসের জন্য একজন স্টাফের নিজস্ব কমিশন সারাংশ (T-12, staff ভিউ) */
export interface MyCommissionSummary {
  month: string;
  commissionRate: number;
  costedOrderCount: number;
  totalOrderCount: number;
  totalBilled: number;
  totalCosting: number;
  grossProfit: number;
  commissionAmount: number;
}
