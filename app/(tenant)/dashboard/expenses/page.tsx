"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeExpensesForMonth, subscribeExpenseCategories, ensureStaffPaymentCategory } from "@/lib/firebase/expenses";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { currentYearMonth } from "@/lib/utils/commission-math";
import { ExpenseFiltersBar } from "@/components/tenant/expenses/expense-filters-bar";
import { ExpenseListTable } from "@/components/tenant/expenses/expense-list-table";
import { ExpenseFormDialog } from "@/components/tenant/expenses/expense-form-dialog";
import { ExpenseMonthSummary } from "@/components/tenant/expenses/expense-month-summary";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { formatDateLocalized } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import type { Branch } from "@/lib/types/dashboard";
import type { Expense, ExpenseCategory } from "@/lib/types/expense";
import { STAFF_PAYMENT_CATEGORY_ID } from "@/lib/types/expense";

/** useSearchParams() requires Suspense boundary in Next.js App Router. */
export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesPageInner />
    </Suspense>
  );
}

function ExpensesPageInner() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const isTenantAdmin = role === "tenant_admin";
  const canManage = isTenantAdmin || role === "branch_manager";

  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);

  // Non-admin roles are always scoped to their own branch — same
  // effectiveBranchId pattern established in T-04 and reused in T-15/T-16.
  const effectiveBranchId = isTenantAdmin ? selectedBranchId : (user?.claims.branchId ?? "all");
  const handleFirestoreError = useFirestoreErrorHandler();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDataExportFeature, setHasDataExportFeature] = useState(false);

  // URL param drilldown থেকে রিপোর্ট পেজের খরচ বিশ্লেষণ পাই চার্ট (সেশন ৬,
  // ১৮ আগস্ট ২০২৬): ?category=... → categoryId প্রি-সিলেক্ট।
  const urlCategory = searchParams.get("category");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">(() => urlCategory ?? "all");
  const [month, setMonth] = useState(currentYearMonth());

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (data) => {
        if (!data) return;
        setHasDataExportFeature(computeEffectiveFeatures(data.planId, data.featureOverrides, data.planFeatures).dataExport);
      },
      handleFirestoreError()
    );
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    // 'স্টাফ পেমেন্ট' সিস্টেম ক্যাটাগরি সবসময় ড্রপডাউনে দেখাতে নিশ্চিত করা হয়,
    // এমনকি এই তেন্যান্টের এখনো কোনো কমিশন উত্তোলন অনুমোদন না হয়ে থাকলেও।
    ensureStaffPaymentCategory(tenantId).catch(handleFirestoreError());
    const unsub = subscribeExpenseCategories(tenantId, setCategories, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);
    // মাস বদলালেই নতুন date-range query — আগে "all-time, ৫০০-ক্যাপ, তারপর
    // client-side month filter" ছিল, যেটা ৫০০+ সারাজীবনের খরচ থাকা টেন্যান্টে
    // পুরনো মাস সিলেক্ট করলে নীরবে অসম্পূর্ণ তথ্য দেখাতো (audit ফিক্স,
    // ১৭ আগস্ট ২০২৬ — দেখুন lib/firebase/expenses.ts-এর subscribeExpensesForMonth)।
    const unsub = subscribeExpensesForMonth(
      tenantId,
      effectiveBranchId,
      month,
      (data) => {
        setExpenses(data);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, month, handleFirestoreError]);

  // দেখানোর জন্য পুরো branches তালিকা টেবিলে দরকার (নাম lookup), কিন্তু ফিল্টার
  // ড্রপডাউন ও ফর্মে non-admin-এর জন্য শুধু নিজের শাখা — T-15/T-16-এর মতো।
  const formBranches = useMemo(
    () => (isTenantAdmin ? branches : branches.filter((b) => b.id === user?.claims.branchId)),
    [isTenantAdmin, branches, user?.claims.branchId]
  );

  // `expenses` state এখন থেকে সরাসরি সিলেক্টেড মাসের data (subscribeExpensesForMonth
  // থেকে, server-side date-range query) — তাই এখানে আলাদা client-side মাস-ফিল্টারের
  // দরকার নেই, শুধু category/search ফিল্টার প্রয়োগ করা হয়।
  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (categoryId !== "all" && expense.categoryId !== categoryId) return false;
      if (term) {
        const haystack = `${expense.description} ${expense.categoryName}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [expenses, search, categoryId]);

  function openCreate() {
    setEditingExpense(null);
    setFormOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branches) map.set(b.id, b.name);
    return map;
  }, [branches]);

  const exportRows = useMemo(
    () =>
      filteredExpenses.map((expense) => [
        expense.date?.toDate?.() ? formatDateLocalized(expense.date.toDate(), locale) : "",
        expense.categoryId === STAFF_PAYMENT_CATEGORY_ID ? t("expenses.staffPaymentCategory") : expense.categoryName,
        branchNameById.get(expense.branchId) ?? "",
        expense.amount,
        expense.description,
        expense.createdByName,
      ]),
    [filteredExpenses, branchNameById, t, locale]
  );

  if (!tenantId) return null;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("expenses.pageTitle")}</h1>
        <div className="flex items-center gap-2">
          <CsvExportButton
            hasDataExportFeature={hasDataExportFeature}
            filenamePrefix={`al-ihsan-printerp-expenses-${month}`}
            headers={[
              t("expenses.date"),
              t("expenses.category"),
              t("expenses.branch"),
              t("expenses.amount"),
              t("expenses.description"),
              t("expenses.createdBy"),
            ]}
            rows={exportRows}
          />
          {canManage && (
            <Button onClick={openCreate}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              {t("expenses.newExpense")}
            </Button>
          )}
        </div>
      </div>

      <ExpenseMonthSummary expenses={filteredExpenses} />

      <ExpenseFiltersBar
        search={search}
        onSearchChange={setSearch}
        categories={categories}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        branches={isTenantAdmin ? branches : []}
        branchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        month={month}
        onMonthChange={setMonth}
      />

      <ExpenseListTable
        tenantId={tenantId}
        expenses={filteredExpenses}
        branches={branches}
        isLoading={isLoading}
        canManage={canManage}
        onEdit={openEdit}
      />

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
        branches={formBranches}
        defaultBranchId={effectiveBranchId}
        categories={categories}
        editingExpense={editingExpense}
      />
    </div>
  );
}
