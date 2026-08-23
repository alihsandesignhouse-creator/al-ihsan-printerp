import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { subscribePagedList, loadMorePagedList } from "./pagination-helpers";
import { round2 } from "@/lib/utils/calculations";
import { logAction } from "./audit";
import { ensureStaffPaymentCategory } from "@/lib/firebase/expenses";
import { STAFF_PAYMENT_CATEGORY_ID } from "@/lib/types/expense";
import { yearMonthToDateRange } from "@/lib/utils/commission-math";
import type { Order } from "@/lib/types/order";
import type { OrderCosting } from "@/lib/types/order-costing";
import type {
  StaffWithdrawal,
  WithdrawalRequestFormData,
  ProcessWithdrawalInput,
} from "@/lib/types/commission";

/** commission.withdrawalType.* (messages/bn.json ও en.json)-এর সাথে সামঞ্জস্যপূর্ণ প্লেইন লেবেল —
 *  এই ফাইলটি data layer, next-intl-এর t() এখানে ব্যবহারযোগ্য নয়, তাই খরচের description-এ
 *  বসানোর জন্য একটি ছোট স্ট্যাটিক bn ম্যাপ রাখা হলো। */
const WITHDRAWAL_TYPE_LABEL_BN: Record<StaffWithdrawal["type"], string> = {
  commission: "কমিশন",
  salary: "বেতন",
  advance: "অগ্রিম",
  other: "অন্যান্য",
};

// ─── Orders + costings (read-only, for commission aggregation) ────────────
// Reuses the same composite indexes as T-01 dashboard.ts
// (deletedAt+createdAt, branchId+deletedAt+createdAt) — no new index needed.
// branchId must be the caller's own branch for non-admin roles (never "all"),
// per the branch-scoped permission pattern established in T-04.

/**
 * ⚠️ All-time অর্ডার, `createdAt` desc দিয়ে ৫০০-তে ক্যাপড। commission ও
 * my-commission পেজ (যেখানে ব্যবহারকারী ANY মাস বেছে নিতে পারেন) এই
 * ফাংশন সরাসরি ব্যবহার করবেন না — নিচের `subscribeOrdersForCommissionMonth`
 * ব্যবহার করুন (audit ফিক্স, ১৭ আগস্ট ২০২৬)। এই ফাংশনটা শুধু সেই ক্ষেত্রে
 * নিরাপদ যেখানে caller নিজে নিশ্চিত যে ফলাফল কোনো নির্দিষ্ট (বিশেষত পুরনো)
 * মাসের সাথে client-side filter করা হবে না।
 */
export function subscribeOrdersForCommission(
  tenantId: string,
  branchId: string | "all",
  callback: (orders: Order[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "orders");
  const constraints = [where("deletedAt", "==", null), orderBy("createdAt", "desc"), fsLimit(500)] as const;

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
 * নির্দিষ্ট (যেকোনো) মাসের অর্ডার — সরাসরি `createdAt` date-range query,
 * কোনো all-time cap-এর ওপর নির্ভর করে না। কমিশন গণনায় ব্যবহৃত সব পেজে
 * (commission, my-commission, my-collection) এটাই ব্যবহার করা উচিত —
 * audit ফিক্স, ১৭ আগস্ট ২০২৬: আগে all-time capped fetch + client-side মাস
 * ফিল্টার ছিল, যেটা ৫০০+ সারাজীবনের অর্ডার থাকা টেন্যান্টে পুরনো মাস
 * সিলেক্ট করলে নীরবে ভুল/অসম্পূর্ণ কমিশন-হিসাব দেখাতো (দেখুন
 * lib/utils/commission-math.ts-এর yearMonthToDateRange কমেন্ট)।
 */
export function subscribeOrdersForCommissionMonth(
  tenantId: string,
  branchId: string | "all",
  yearMonth: string,
  callback: (orders: Order[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "orders");
  const { start, end } = yearMonthToDateRange(yearMonth);
  const startTs = Timestamp.fromDate(start);
  const endTs = Timestamp.fromDate(end);
  const constraints = [
    where("deletedAt", "==", null),
    where("createdAt", ">=", startTs),
    where("createdAt", "<", endTs),
    orderBy("createdAt", "desc"),
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

export function subscribeOrderCostingsMap(
  tenantId: string,
  branchId: string | "all",
  callback: (costingsByOrderId: Map<string, OrderCosting>) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "order_costings");
  const q = branchId === "all" ? query(colRef) : query(colRef, where("branchId", "==", branchId));

  return onSnapshot(
    q,
    (snapshot) => {
      const map = new Map<string, OrderCosting>();
      snapshot.docs.forEach((d) => {
        const costing = { id: d.id, ...d.data() } as OrderCosting;
        map.set(costing.orderId, costing);
      });
      callback(map);
    },
    (error) => onError(error as Error)
  );
}

// ─── Staff withdrawals ──────────────────────────────────────────────────

/** Tenant Admin / Branch Manager view — all withdrawal requests in scope, newest first. */
/**
 * Tenant Admin / Branch Manager view — all withdrawal requests in scope, newest first.
 * audit ফিক্স (১৭ আগস্ট ২০২৬): আগে এই query কোনো cap ছাড়াই ছিল — orders-এর
 * "ক্যাপড হয়ে ডেটা বাদ পড়া" সমস্যার বিপরীত: সময়ের সাথে উত্তোলনের সংখ্যা
 * বাড়লে প্রতিবার পুরো ইতিহাস আনা অপ্রয়োজনীয় read cost বাড়াতো। এখন
 * pagination-helpers.ts-এর একই cursor-pagination প্যাটার্ন প্রয়োগ করা
 * হয়েছে (orders/customers/items ইত্যাদির মতো) — `hasMore` + `loadMoreStaffWithdrawals`।
 */
export function subscribeStaffWithdrawals(
  tenantId: string,
  branchId: string | "all",
  callback: (withdrawals: StaffWithdrawal[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "staff_withdrawals");
  const constraints = branchId === "all" ? [] : [where("branchId", "==", branchId)];
  return subscribePagedList<StaffWithdrawal>(
    colRef,
    constraints,
    "requestedAt",
    "desc",
    callback,
    (error) => onError(error as Error)
  );
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — commission/page.tsx দেখুন। */
export async function loadMoreStaffWithdrawals(
  tenantId: string,
  branchId: string | "all",
  lastWithdrawal: Pick<StaffWithdrawal, "id" | "requestedAt">
): Promise<{ items: StaffWithdrawal[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "staff_withdrawals");
  const constraints = branchId === "all" ? [] : [where("branchId", "==", branchId)];
  return loadMorePagedList<StaffWithdrawal>(
    colRef,
    constraints,
    "requestedAt",
    "desc",
    lastWithdrawal.requestedAt,
    lastWithdrawal.id
  );
}

/** Staff's own view — their own withdrawal request history, newest first. */
/**
 * স্টাফ নিজের উত্তোলনের ইতিহাস — একই cursor-pagination প্যাটার্ন (audit
 * ফিক্স, ১৭ আগস্ট ২০২৬, subscribeStaffWithdrawals-এর কমেন্ট দেখুন)।
 */
export function subscribeMyWithdrawals(
  tenantId: string,
  staffId: string,
  callback: (withdrawals: StaffWithdrawal[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "staff_withdrawals");
  return subscribePagedList<StaffWithdrawal>(
    colRef,
    [where("staffId", "==", staffId)],
    "requestedAt",
    "desc",
    callback,
    (error) => onError(error as Error)
  );
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — my-commission/page.tsx দেখুন। */
export async function loadMoreMyWithdrawals(
  tenantId: string,
  staffId: string,
  lastWithdrawal: Pick<StaffWithdrawal, "id" | "requestedAt">
): Promise<{ items: StaffWithdrawal[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "staff_withdrawals");
  return loadMorePagedList<StaffWithdrawal>(
    colRef,
    [where("staffId", "==", staffId)],
    "requestedAt",
    "desc",
    lastWithdrawal.requestedAt,
    lastWithdrawal.id
  );
}

/**
 * স্টাফ উত্তোলনের আবেদন করে (blueprint T-12: "স্টাফ উত্তোলনের আবেদন")।
 * status সবসময় 'pending' দিয়ে শুরু হয় — অনুমোদন processWithdrawal() দিয়ে হয়।
 */
export async function requestWithdrawal(
  tenantId: string,
  staff: { id: string; name: string; branchId: string },
  input: WithdrawalRequestFormData
): Promise<void> {
  const ref = doc(collection(db, "tenants", tenantId, "staff_withdrawals"));
  const amount = round2(input.amount);

  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      id: ref.id,
      tenantId,
      branchId: staff.branchId,
      staffId: staff.id,
      staffName: staff.name,
      type: input.type,
      month: input.month,
      requestedAmount: amount,
      amount,
      note: input.note.trim(),
      status: "pending",
      requestedBy: staff.id,
      requestedAt: serverTimestamp(),
      processedBy: null,
      processedByName: null,
      processedAt: null,
      adminNote: "",
      editedByAdmin: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  void logAction(tenantId, "withdrawal.requested", "withdrawal", ref.id, {
    staffId: staff.id,
    staffName: staff.name,
    type: input.type,
    amount,
  });
}

/**
 * Admin/Branch Manager একটি pending উত্তোলন অনুমোদন বা প্রত্যাখ্যান করেন।
 * অনুমোদনের সময় পরিমাণ সম্পাদনা করা গেলে `editedByAdmin: true` সেট হয়
 * (blueprint T-12: "অ্যাডমিন সম্পাদনা করলে edited_by_admin: true")।
 * ইতিমধ্যে প্রক্রিয়াকৃত (pending নয়) একটি রিকোয়েস্ট আবার প্রসেস করা যাবে না।
 *
 * blueprint T-12/T-13: অনুমোদনের সময় স্বয়ংক্রিয়ভাবে 'স্টাফ পেমেন্ট'
 * ক্যাটাগরিতে একটি Expense তৈরি হয় (একই transaction-এ, atomic) — সরাসরি
 * `staff_withdrawals` ডকুমেন্টের `branchId`/`amount`/`staffName` ব্যবহার করে,
 * যা এই মডিউল প্রথম থেকেই সেই ভবিষ্যৎ সংযোগের জন্য প্রস্তুত রেখেছিল।
 */
export async function processWithdrawal(
  tenantId: string,
  processor: { uid: string; name: string },
  withdrawalId: string,
  input: ProcessWithdrawalInput
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "staff_withdrawals", withdrawalId);

  // 'স্টাফ পেমেন্ট' ক্যাটাগরি ডকুমেন্ট নিশ্চিত করা — এটি নিজের একটি independent
  // transaction চালায়, তাই নিচের মূল transaction শুরুর *আগে* কল করতে হবে
  // (Firestore nested runTransaction() সাপোর্ট করে না)। শুধু approve path-এ
  // দরকার, কিন্তু reject-এর জন্যও কল করলে কোনো ক্ষতি নেই (idempotent, সস্তা)।
  if (input.action === "approve") {
    await ensureStaffPaymentCategory(tenantId);
  }

  const expenseRef = doc(collection(db, "tenants", tenantId, "expenses"));
  let finalAmountForLog = 0;
  let staffNameForLog = "";
  let editedByAdminForLog = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("commission.withdrawalNotFound");
    const existing = snap.data() as StaffWithdrawal;
    if (existing.status !== "pending") {
      throw new Error("commission.alreadyProcessed");
    }

    const finalAmount =
      input.action === "approve" && input.adjustedAmount !== null
        ? round2(input.adjustedAmount)
        : existing.requestedAmount;
    const editedByAdmin =
      input.action === "approve" && input.adjustedAmount !== null && finalAmount !== existing.requestedAmount;

    finalAmountForLog = finalAmount;
    staffNameForLog = existing.staffName;
    editedByAdminForLog = editedByAdmin;

    tx.update(ref, {
      status: input.action === "approve" ? "approved" : "rejected",
      amount: finalAmount,
      editedByAdmin,
      adminNote: input.adminNote.trim(),
      processedBy: processor.uid,
      processedByName: processor.name,
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.action === "approve") {
      const typeLabel = WITHDRAWAL_TYPE_LABEL_BN[existing.type];
      tx.set(expenseRef, {
        id: expenseRef.id,
        tenantId,
        branchId: existing.branchId,
        categoryId: STAFF_PAYMENT_CATEGORY_ID,
        categoryName: "স্টাফ পেমেন্ট",
        amount: finalAmount,
        date: Timestamp.now(),
        description: `${existing.staffName} — ${typeLabel} উত্তোলন`,
        sourceWithdrawalId: withdrawalId,
        createdBy: processor.uid,
        createdByName: processor.name,
        deletedAt: null,
        deletedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  void logAction(
    tenantId,
    input.action === "approve" ? "withdrawal.approved" : "withdrawal.rejected",
    "withdrawal",
    withdrawalId,
    {
      staffName: staffNameForLog,
      amount: finalAmountForLog,
      editedByAdmin: editedByAdminForLog,
      adminNote: input.adminNote.trim(),
    }
  );
}
