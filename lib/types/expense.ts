import type { Timestamp } from "firebase/firestore";

// ─── Expense Management — Module T-13 (স্ট্যান্ডার্ড+) ─────────────────────
//
// Blueprint অংশ ৯, T-13:
//   "খরচের তারিখ * | ক্যাটাগরি * (কাস্টম তালিকা)
//    টাকার পরিমাণ * | বিবরণ
//    শাখা
//    কাস্টম ক্যাটাগরি নিজে তৈরি করা যাবে। 'স্টাফ পেমেন্ট' সিস্টেম-নিয়ন্ত্রিত।"
//
// প্রবেশাধিকার T-15/T-16 (Stock/Suppliers)-এর মতো: TENANT_ADMIN সব শাখা,
// BRANCH_MANAGER শুধু নিজের শাখা — COMMISSION_STAFF/REGULAR_STAFF এর অ্যাক্সেস
// নেই (sidebar.tsx-এ ইতিমধ্যে roles: ["tenant_admin", "branch_manager"] দিয়ে
// গেটেড, এই সেশনে অপরিবর্তিত)।

/**
 * সিস্টেম-নিয়ন্ত্রিত ক্যাটাগরির ডিটারমিনিস্টিক ডকুমেন্ট ID — যাতে দুইবার তৈরি
 * না হয় এবং কমিশন মডিউল (T-12) থেকে সরাসরি রেফারেন্স করা যায়।
 */
export const STAFF_PAYMENT_CATEGORY_ID = "staff_payment";

/**
 * /tenants/{tenantId}/expense_categories/{categoryId}
 *
 * `isSystem: true` শুধু 'স্টাফ পেমেন্ট' ক্যাটাগরির জন্য — এটি ব্যবহারকারী
 * সম্পাদনা বা মুছে ফেলতে পারবেন না (UI ও Firestore rules উভয় স্তরে সুরক্ষিত)।
 * অন্য সব ক্যাটাগরি ব্যবহারকারীর তৈরি — খরচের ফর্ম থেকে ইনলাইনে যোগ করা যায়।
 */
export interface ExpenseCategory {
  id: string;
  tenantId: string;
  name: string;
  isSystem: boolean;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * /tenants/{tenantId}/expenses/{expenseId}
 *
 * `categoryName` ইচ্ছাকৃতভাবে ডিনরমালাইজড — ক্যাটাগরি পরে মুছে ফেলা হলেও
 * পুরনো খরচের রেকর্ডে সঠিক নাম দেখাবে। ব্যতিক্রম: `categoryId ===
 * STAFF_PAYMENT_CATEGORY_ID` হলে UI সবসময় t("expenses.staffPaymentCategory")
 * দিয়ে রেন্ডার করে (ভাষা টগলের সাথে সামঞ্জস্যপূর্ণ থাকতে, স্ট্যাটাস ব্যাজের
 * মতো), `categoryName` ফিল্ড নিজে নয়।
 *
 * `sourceWithdrawalId` non-null হলে বোঝায় এই খরচ T-12-এর অনুমোদিত স্টাফ
 * উত্তোলন থেকে স্বয়ংক্রিয়ভাবে তৈরি — blueprint T-12: "উত্তোলন স্বয়ংক্রিয়ভাবে
 * 'স্টাফ পেমেন্ট' ক্যাটাগরিতে Expense যোগ করে"। এই ধরনের খরচ UI-তে সম্পাদনা/
 * মুছে ফেলার অপশন ছাড়া দেখানো হয় (উৎস withdrawal রেকর্ডই সত্যের উৎস)।
 */
export interface Expense {
  id: string;
  tenantId: string;
  branchId: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  date: Timestamp;
  description: string;
  sourceWithdrawalId: string | null;
  createdBy: string;
  createdByName: string;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** নতুন ক্যাটাগরি নির্বাচনের জন্য ফর্মের sentinel value (UI-only, Firestore-এ কখনো লেখা হয় না) */
export const NEW_CATEGORY_OPTION = "__new__";

export interface ExpenseFormData {
  date: string; // yyyy-MM-dd (HTML date input)
  categoryId: string; // NEW_CATEGORY_OPTION হতে পারে
  newCategoryName: string; // categoryId === NEW_CATEGORY_OPTION হলে ব্যবহৃত
  amount: number;
  description: string;
  branchId: string;
}
