import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { subscribePagedList, loadMorePagedList } from "./pagination-helpers";
import { round2 } from "@/lib/utils/calculations";
import { yearMonthToDateRange } from "@/lib/utils/commission-math";
import { logAction } from "./audit";
import { STAFF_PAYMENT_CATEGORY_ID } from "@/lib/types/expense";
import type { Expense, ExpenseCategory, ExpenseFormData } from "@/lib/types/expense";

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

// ─── Expense categories (real-time) ────────────────────────────────────────

/**
 * Real-time expense category list. Always excludes soft-deleted categories.
 * Not branch-scoped — categories are tenant-wide (blueprint T-13: কাস্টম
 * ক্যাটাগরি তালিকা, শাখাভিত্তিক নয়)।
 */
export function subscribeExpenseCategories(
  tenantId: string,
  callback: (categories: ExpenseCategory[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "expense_categories");
  const q = query(colRef, where("deletedAt", "==", null), orderBy("name", "asc"));

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ExpenseCategory)),
    (error) => onError(error as Error)
  );
}

/**
 * 'স্টাফ পেমেন্ট' সিস্টেম ক্যাটাগরি প্রথমবার প্রয়োজন হলে lazily তৈরি করে —
 * ডিটারমিনিস্টিক ID (`STAFF_PAYMENT_CATEGORY_ID`) ব্যবহার করে idempotent
 * merge-write, তাই একাধিকবার কল করলেও ডুপ্লিকেট তৈরি হয় না। এই ফাংশন
 * Expense পেজ লোড হওয়ার সময় (যাতে ড্রপডাউনে সবসময় দেখা যায়) এবং কমিশন
 * উত্তোলন অনুমোদনের সময় (processWithdrawal, lib/firebase/commission.ts)
 * — দুই জায়গা থেকেই কল হয়।
 */
export async function ensureStaffPaymentCategory(tenantId: string): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "expense_categories", STAFF_PAYMENT_CATEGORY_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await runTransaction(db, async (tx) => {
    const freshSnap = await tx.get(ref);
    if (freshSnap.exists()) return;
    tx.set(ref, {
      id: STAFF_PAYMENT_CATEGORY_ID,
      tenantId,
      name: "স্টাফ পেমেন্ট",
      isSystem: true,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function createExpenseCategory(tenantId: string, name: string): Promise<string> {
  const ref = doc(collection(db, "tenants", tenantId, "expense_categories"));
  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      id: ref.id,
      tenantId,
      name: name.trim(),
      isSystem: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  void logAction(tenantId, "expense_category.created", "expense_category", ref.id, { name: name.trim() });
  return ref.id;
}

/** সিস্টেম ক্যাটাগরি মুছে ফেলা যাবে না — কল করার আগে UI নিজেই বাটন লুকায়, এটি দ্বিতীয় স্তরের সুরক্ষা। */
export async function deleteExpenseCategory(tenantId: string, categoryId: string, userId: string): Promise<void> {
  if (categoryId === STAFF_PAYMENT_CATEGORY_ID) throw new Error("expenses.systemCategoryProtected");
  const ref = doc(db, "tenants", tenantId, "expense_categories", categoryId);
  let categoryName = "";
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("expenses.categoryNotFound");
    const category = snap.data() as ExpenseCategory;
    if (category.isSystem) throw new Error("expenses.systemCategoryProtected");
    categoryName = category.name;
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
  void logAction(tenantId, "expense_category.deleted", "expense_category", categoryId, { name: categoryName });
}

// ─── Expenses (real-time) ───────────────────────────────────────────────────

/**
 * Real-time expense list subscription, most recent date first. Always
 * excludes soft-deleted expenses. Branch filtering for Tenant Admin happens
 * here; Branch Manager scoping is additionally enforced server-side by
 * Firebase Security Rules — same shape as subscribeStockItems/subscribeSuppliers.
 */
/**
 * Real-time expense list subscription, most recent date first. Always
 * excludes soft-deleted expenses. Branch filtering for Tenant Admin happens
 * here; Branch Manager scoping is additionally enforced server-side by
 * Firebase Security Rules — same shape as subscribeStockItems/subscribeSuppliers.
 *
 * ⚠️ এই ফাংশনটা সব-সময়ের ডেটা ৫০০-তে ক্যাপ করে আনে (hasMore পেজিনেশন সহ,
 * দেখুন pagination-helpers.ts)। expenses পেজ যেহেতু "নির্দিষ্ট একটা মাস"
 * দেখানোর জন্য ব্যবহার করে, ভুল করে এই ফাংশনটা মাস-ফিল্টারিং-এর সাথে
 * client-side ব্যবহার করবেন না — নিচের `subscribeExpensesForMonth` ব্যবহার
 * করুন, যেটা date-range দিয়ে সরাসরি সঠিক মাসের ডেটা আনে (audit ফিক্স,
 * ১৭ আগস্ট ২০২৬)।
 */
export function subscribeExpenses(
  tenantId: string,
  branchId: string | "all",
  callback: (expenses: Expense[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "expenses");
  const constraints = branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return subscribePagedList<Expense>(
    colRef,
    constraints,
    "date",
    "desc",
    callback,
    (error) => onError(error as Error)
  );
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — expenses/page.tsx দেখুন। */
export async function loadMoreExpenses(
  tenantId: string,
  branchId: string | "all",
  lastExpense: Pick<Expense, "id" | "date">
): Promise<{ items: Expense[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "expenses");
  const constraints = branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return loadMorePagedList<Expense>(colRef, constraints, "date", "desc", lastExpense.date, lastExpense.id);
}

/**
 * নির্দিষ্ট (যেকোনো — চলতি বা অতীত) মাসের খরচ — সরাসরি date-range query,
 * কোনো all-time cap-এর ওপর নির্ভর করে না (audit ফিক্স, ১৭ আগস্ট ২০২৬,
 * দেখুন yearMonthToDateRange-এর কমেন্ট)। `expenses` পেজের MonthPicker-এর
 * জন্য ব্যবহৃত — `subscribeExpenses` (all-time, capped) না।
 */
export function subscribeExpensesForMonth(
  tenantId: string,
  branchId: string | "all",
  yearMonth: string,
  callback: (expenses: Expense[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "expenses");
  const { start, end } = yearMonthToDateRange(yearMonth);
  const startTs = Timestamp.fromDate(start);
  const endTs = Timestamp.fromDate(end);
  const baseConstraints = [
    where("deletedAt", "==", null),
    where("date", ">=", startTs),
    where("date", "<", endTs),
    orderBy("date", "desc"),
  ] as const;

  const q =
    branchId === "all"
      ? query(colRef, ...baseConstraints)
      : query(colRef, where("branchId", "==", branchId), ...baseConstraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)),
    (error) => onError(error as Error)
  );
}

/**
 * চলতি মাসের খরচ — Dashboard KPI (নেট মুনাফা) ও এই মডিউলের মাসিক সারাংশ
 * কার্ড উভয়ের জন্য ব্যবহৃত। T-01-এর subscribeMonthPayments-এর সমান্তরাল প্যাটার্ন।
 */
export function subscribeMonthExpenses(
  tenantId: string,
  branchId: string | "all",
  callback: (expenses: Expense[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "expenses");
  const monthStart = Timestamp.fromDate(startOfMonth(new Date()));
  const baseConstraints = [where("deletedAt", "==", null), where("date", ">=", monthStart)] as const;

  const q =
    branchId === "all"
      ? query(colRef, ...baseConstraints)
      : query(colRef, where("branchId", "==", branchId), ...baseConstraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)),
    (error) => onError(error as Error)
  );
}

// ─── Create / edit / soft-delete expense ───────────────────────────────────

interface ResolvedCategory {
  id: string;
  name: string;
}

async function resolveCategory(
  tenantId: string,
  categoryId: string,
  newCategoryName: string,
  existingCategories: ExpenseCategory[]
): Promise<ResolvedCategory> {
  if (categoryId === STAFF_PAYMENT_CATEGORY_ID) {
    throw new Error("expenses.systemCategoryProtected");
  }
  const trimmedNew = newCategoryName.trim();
  if (trimmedNew) {
    const newId = await createExpenseCategory(tenantId, trimmedNew);
    return { id: newId, name: trimmedNew };
  }
  const existing = existingCategories.find((c) => c.id === categoryId);
  if (!existing) throw new Error("expenses.categoryNotFound");
  return { id: existing.id, name: existing.name };
}

export async function createExpense(
  tenantId: string,
  actor: { uid: string; name: string },
  input: ExpenseFormData,
  existingCategories: ExpenseCategory[]
): Promise<string> {
  const category = await resolveCategory(tenantId, input.categoryId, input.newCategoryName, existingCategories);
  const ref = doc(collection(db, "tenants", tenantId, "expenses"));
  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      id: ref.id,
      tenantId,
      branchId: input.branchId,
      categoryId: category.id,
      categoryName: category.name,
      amount: round2(input.amount),
      date: Timestamp.fromDate(new Date(`${input.date}T00:00:00`)),
      description: input.description.trim(),
      sourceWithdrawalId: null,
      createdBy: actor.uid,
      createdByName: actor.name,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  void logAction(tenantId, "expense.created", "expense", ref.id, {
    branchId: input.branchId,
    categoryName: category.name,
    amount: round2(input.amount),
  });
  return ref.id;
}

export async function updateExpense(
  tenantId: string,
  expenseId: string,
  input: ExpenseFormData,
  existingCategories: ExpenseCategory[]
): Promise<void> {
  // Category must be resolved (possibly creating a new one) *before* opening
  // the expense transaction below — createExpenseCategory() runs its own
  // independent transaction, and Firestore does not support nesting one
  // runTransaction() call inside another's callback.
  const category = await resolveCategory(tenantId, input.categoryId, input.newCategoryName, existingCategories);

  const ref = doc(db, "tenants", tenantId, "expenses", expenseId);
  let previous: { categoryName: string; amount: number; date: string; description: string } | null = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("expenses.notFound");
    const existing = snap.data() as Expense;
    if (existing.sourceWithdrawalId) throw new Error("expenses.autoEntryNotEditable");
    previous = {
      categoryName: existing.categoryName,
      amount: existing.amount,
      date: input.date,
      description: existing.description,
    };

    tx.update(ref, {
      categoryId: category.id,
      categoryName: category.name,
      amount: round2(input.amount),
      date: Timestamp.fromDate(new Date(`${input.date}T00:00:00`)),
      description: input.description.trim(),
      updatedAt: serverTimestamp(),
    });
  });

  void logAction(tenantId, "expense.updated", "expense", expenseId, {
    before: previous,
    after: { categoryName: category.name, amount: round2(input.amount), description: input.description.trim() },
  });
}

export async function softDeleteExpense(tenantId: string, expenseId: string, userId: string): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "expenses", expenseId);
  let categoryName = "";
  let amount = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("expenses.notFound");
    const existing = snap.data() as Expense;
    if (existing.sourceWithdrawalId) throw new Error("expenses.autoEntryNotEditable");
    categoryName = existing.categoryName;
    amount = existing.amount;
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
  void logAction(tenantId, "expense.soft_deleted", "expense", expenseId, { categoryName, amount });
}
