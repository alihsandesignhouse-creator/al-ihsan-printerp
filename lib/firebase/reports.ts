import {
  collection,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  getDocs,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import type { Order, Payment } from "@/lib/types/dashboard";
import type { Expense } from "@/lib/types/expense";
import type { OrderItem } from "@/lib/types/order";
import type { ItemAnalysisResult } from "@/lib/types/report";
import { computeItemAnalysis } from "@/lib/utils/report-analytics";

// একটি খুব বড় custom রেঞ্জ (যেমন কয়েক বছর) নির্বাচন করলেও একটি একক রিপোর্ট
// পেজ-লোডে Firestore read সীমাহীন না হয়ে যায় তার জন্য একটি যুক্তিসঙ্গত cap —
// dashboard.ts-এর subscribeOrders/subscribeMonthPayments-এর মতোই নীতি,
// কিন্তু রিপোর্টের জন্য সীমা বড় রাখা হয়েছে (500 নয়, 3000) কারণ ব্যবহারকারী
// ইচ্ছাকৃতভাবে "এই বছর"-এর মতো দীর্ঘ রেঞ্জ বেছে নিতে পারেন।
const REPORT_QUERY_CAP = 3000;

/**
 * নির্বাচিত তারিখ রেঞ্জের অর্ডার (createdAt ভিত্তিক, soft-deleted বাদে)।
 * বিদ্যমান কম্পোজিট ইনডেক্স পুনরায় ব্যবহার করে —
 * (deletedAt ASC, createdAt DESC) এবং (branchId ASC, deletedAt ASC, createdAt DESC),
 * যা lib/firebase/commission.ts (subscribeOrdersForCommission) ইতিমধ্যে ব্যবহার করে।
 * নতুন কোনো ইনডেক্স প্রয়োজন হয়নি।
 */
export function subscribeOrdersInRange(
  tenantId: string,
  branchId: string | "all",
  start: Date,
  end: Date,
  callback: (orders: Order[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "orders");
  const constraints = [
    where("deletedAt", "==", null),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
    fsLimit(REPORT_QUERY_CAP),
  ] as const;

  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    (error) => onError(error as Error)
  );
}

/**
 * নির্বাচিত তারিখ রেঞ্জের পেমেন্ট (paymentDate ভিত্তিক, soft-deleted বাদে —
 * সেশন ২ cascade)। ইনডেক্স: (deletedAt ASC, paymentDate DESC) /
 * (branchId ASC, deletedAt ASC, paymentDate DESC)।
 */
export function subscribePaymentsInRange(
  tenantId: string,
  branchId: string | "all",
  start: Date,
  end: Date,
  callback: (payments: Payment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "payments");
  // সেশন ২ (soft-delete cascade): cascade-soft-deleted payment বাদ দিতে
  // deletedAt==null যোগ হলো — composite index (deletedAt ASC, paymentDate DESC)
  // এবং (branchId ASC, deletedAt ASC, paymentDate DESC), দেখুন firestore.indexes.json।
  const constraints = [
    where("deletedAt", "==", null),
    where("paymentDate", ">=", Timestamp.fromDate(start)),
    where("paymentDate", "<=", Timestamp.fromDate(end)),
    orderBy("paymentDate", "desc"),
    fsLimit(REPORT_QUERY_CAP),
  ] as const;

  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment)),
    (error) => onError(error as Error)
  );
}

/**
 * নির্বাচিত তারিখ রেঞ্জের খরচ (date ভিত্তিক, soft-deleted বাদে)। বিদ্যমান
 * ইনডেক্স (deletedAt ASC, date ASC/DESC) / (branchId ASC, deletedAt ASC, date)
 * পুনরায় ব্যবহৃত — lib/firebase/expenses.ts-এর subscribeExpenses-এর সমান্তরাল।
 */
export function subscribeExpensesInRange(
  tenantId: string,
  branchId: string | "all",
  start: Date,
  end: Date,
  callback: (expenses: Expense[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "expenses");
  const constraints = [
    where("deletedAt", "==", null),
    where("date", ">=", Timestamp.fromDate(start)),
    where("date", "<=", Timestamp.fromDate(end)),
    orderBy("date", "desc"),
    fsLimit(REPORT_QUERY_CAP),
  ] as const;

  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)),
    (error) => onError(error as Error)
  );
}

// ─── আইটেম বিশ্লেষণ — order_items subcollection (T-18-এর একমাত্র "imperative fetch") ──
//
// order_items কালেকশন-লেভেল আইটেমে tenantId ফিল্ড নেই (দেখুন lib/types/order.ts,
// OrderItem) — শুধু orderId — তাই একটি নিরাপদ, tenant-scoped collectionGroup
// query বসানো এই সেশনের স্কোপের বাইরে একটি বড় আর্কিটেকচার পরিবর্তন হতো।
// পরিবর্তে, নির্বাচিত রেঞ্জের প্রতিটি অর্ডারের order_items subcollection আলাদাভাবে
// পড়া হয় (Firestore rules ইতিমধ্যে belongsToTenant()-ভিত্তিক অনুমতি দেয়,
// কোনো নতুন rule লাগেনি)। বড় রেঞ্জে খরচ নিয়ন্ত্রণে সাম্প্রতিক সর্বোচ্চ
// `maxOrders`-টি অর্ডারে সীমাবদ্ধ — এটি এই সেশনের একটি সচেতন scoping সিদ্ধান্ত,
// UI-তে isCapped ফ্ল্যাগ দিয়ে স্বচ্ছভাবে জানানো হয়।
export async function fetchOrderItemsForOrders(
  tenantId: string,
  ordersInRange: Order[],
  maxOrders: number
): Promise<ItemAnalysisResult> {
  const totalOrdersInRange = ordersInRange.length;
  const isCapped = totalOrdersInRange > maxOrders;
  // orders ইতিমধ্যে createdAt desc সাজানো (subscribeOrdersInRange) — সাম্প্রতিক
  // অর্ডারগুলোই রাখা হয় ক্যাপের ক্ষেত্রে।
  const scoped = isCapped ? ordersInRange.slice(0, maxOrders) : ordersInRange;

  const perOrderItems = await Promise.all(
    scoped.map(async (order) => {
      const itemsCol = collection(db, "tenants", tenantId, "orders", order.id, "order_items");
      const snap = await getDocs(query(itemsCol, orderBy("sortOrder", "asc")));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderItem);
    })
  );

  const flatItems = perOrderItems.flat();

  return {
    rows: computeItemAnalysis(flatItems),
    isCapped,
    ordersScanned: scoped.length,
    totalOrdersInRange,
  };
}
