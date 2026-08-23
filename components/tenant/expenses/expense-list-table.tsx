"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDateLocalized } from "@/lib/utils/format";
import { Pencil, Trash2, Receipt, Zap } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { softDeleteExpense } from "@/lib/firebase/expenses";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatTaka } from "@/lib/utils/calculations";
import { STAFF_PAYMENT_CATEGORY_ID } from "@/lib/types/expense";
import type { Expense } from "@/lib/types/expense";
import type { Branch } from "@/lib/types/dashboard";

function formatDate(expense: Expense, locale: string): string {
  const date = expense.date?.toDate?.();
  if (!date) return "";
  return formatDateLocalized(date, locale);
}

interface ExpenseListTableProps {
  tenantId: string;
  expenses: Expense[];
  branches: Branch[];
  isLoading: boolean;
  canManage: boolean;
  onEdit: (expense: Expense) => void;
  onDeleted?: () => void;
}

export function ExpenseListTable({
  tenantId,
  expenses,
  branches,
  isLoading,
  canManage,
  onEdit,
  onDeleted,
}: ExpenseListTableProps) {
  const t = useTranslations();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  async function confirmDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    try {
      await softDeleteExpense(tenantId, deleteTarget.id, user.uid);
      onDeleted?.();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <Receipt className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("expenses.noExpensesFound")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">{t("expenses.date")}</th>
                <th className="px-4 py-2.5">{t("expenses.category")}</th>
                <th className="px-4 py-2.5">{t("expenses.description")}</th>
                <th className="px-4 py-2.5">{t("expenses.branch")}</th>
                <th className="px-4 py-2.5 text-right">{t("expenses.amount")}</th>
                <th className="px-4 py-2.5 text-right">{t("expenses.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {expenses.map((expense) => {
                const isAutoEntry = expense.sourceWithdrawalId !== null;
                const categoryLabel =
                  expense.categoryId === STAFF_PAYMENT_CATEGORY_ID
                    ? t("expenses.staffPaymentCategory")
                    : expense.categoryName;
                return (
                  <tr key={expense.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-600">{formatDate(expense, locale)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                        {categoryLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      <div className="flex items-center gap-1.5">
                        {isAutoEntry && (
                          <span
                            title={t("expenses.autoEntry")}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600"
                          >
                            <Zap className="h-3 w-3" aria-hidden="true" />
                            {t("expenses.autoEntry")}
                          </span>
                        )}
                        <span>{expense.description || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{branchNameById.get(expense.branchId) ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-neutral-900">
                      {formatTaka(expense.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && !isAutoEntry && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title={t("common.edit")}
                            onClick={() => onEdit(expense)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("common.delete")}
                            onClick={() => setDeleteTarget(expense)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-status-danger hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("expenses.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("expenses.confirmDeleteDescription", { amount: formatTaka(deleteTarget?.amount ?? 0) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
