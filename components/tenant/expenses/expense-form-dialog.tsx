"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createExpense, updateExpense } from "@/lib/firebase/expenses";
import { useAuthStore } from "@/lib/stores/auth-store";
import { NEW_CATEGORY_OPTION, STAFF_PAYMENT_CATEGORY_ID } from "@/lib/types/expense";
import type { Expense, ExpenseCategory } from "@/lib/types/expense";
import type { Branch } from "@/lib/types/dashboard";

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  branches: Branch[];
  defaultBranchId: string | "all";
  categories: ExpenseCategory[];
  editingExpense: Expense | null;
  onSaved?: () => void;
}

interface FormFields {
  date: string;
  categoryId: string;
  newCategoryName: string;
  amount: string;
  description: string;
  branchId: string;
}

function todayIso(): string {
  return toIsoDateLocal(new Date());
}

function toIsoDateLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const EMPTY_FORM: FormFields = {
  date: "",
  categoryId: "",
  newCategoryName: "",
  amount: "",
  description: "",
  branchId: "",
};

export function ExpenseFormDialog({
  open,
  onOpenChange,
  tenantId,
  branches,
  defaultBranchId,
  categories,
  editingExpense,
  onSaved,
}: ExpenseFormDialogProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const isEdit = editingExpense !== null;

  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 'স্টাফ পেমেন্ট' স্বয়ংক্রিয় খরচ কখনো এই ফর্মে সম্পাদনার জন্য আসবে না —
  // ExpenseListTable ইতিমধ্যে সেই সারিতে সম্পাদনা বাটন লুকায় (blueprint T-12/
  // T-13: withdrawal-উৎপন্ন expense-এর উৎস withdrawal রেকর্ডই সত্যের উৎস)।
  const selectableCategories = categories.filter((c) => c.id !== STAFF_PAYMENT_CATEGORY_ID);

  useEffect(() => {
    if (!open) return;
    if (editingExpense) {
      setFields({
        date: toIsoDateLocal(editingExpense.date.toDate()),
        categoryId: editingExpense.categoryId,
        newCategoryName: "",
        amount: String(editingExpense.amount),
        description: editingExpense.description,
        branchId: editingExpense.branchId,
      });
    } else {
      setFields({
        ...EMPTY_FORM,
        date: todayIso(),
        branchId: defaultBranchId !== "all" ? defaultBranchId : (branches[0]?.id ?? ""),
      });
    }
    setError(null);
  }, [open, editingExpense, defaultBranchId, branches]);

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!fields.date) return t("validation.dateRequired");
    if (fields.categoryId === NEW_CATEGORY_OPTION) {
      if (!fields.newCategoryName.trim()) return t("expenses.newCategoryNameRequired");
    } else if (!fields.categoryId) {
      return t("expenses.categoryRequired");
    }
    const amount = Number(fields.amount);
    if (!fields.amount || Number.isNaN(amount) || amount <= 0) return t("validation.amountInvalid");
    if (branches.length > 0 && !fields.branchId) return t("validation.branchRequired");
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const input = {
        date: fields.date,
        categoryId: fields.categoryId,
        newCategoryName: fields.categoryId === NEW_CATEGORY_OPTION ? fields.newCategoryName : "",
        amount: Number(fields.amount),
        description: fields.description,
        branchId: fields.branchId,
      };
      if (isEdit && editingExpense) {
        await updateExpense(tenantId, editingExpense.id, input, categories);
      } else {
        await createExpense(tenantId, { uid: user.uid, name: user.displayName ?? "" }, input, categories);
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError(t("expenses.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventOutsideClose>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("expenses.editExpense") : t("expenses.newExpense")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="expenseDate">{t("expenses.date")} *</Label>
              <Input
                id="expenseDate"
                type="date"
                value={fields.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="expenseAmount">{t("expenses.amount")} *</Label>
              <Input
                id="expenseAmount"
                type="number"
                min={0}
                step="any"
                value={fields.amount}
                onChange={(e) => update("amount", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="expenseCategory">{t("expenses.category")} *</Label>
            <select
              id="expenseCategory"
              value={fields.categoryId}
              onChange={(e) => update("categoryId", e.target.value)}
              className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="">{t("expenses.selectCategory")}</option>
              {selectableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CATEGORY_OPTION}>{t("expenses.addNewCategory")}</option>
            </select>
          </div>

          {fields.categoryId === NEW_CATEGORY_OPTION && (
            <div>
              <Label htmlFor="expenseNewCategory">{t("expenses.newCategoryName")} *</Label>
              <Input
                id="expenseNewCategory"
                value={fields.newCategoryName}
                onChange={(e) => update("newCategoryName", e.target.value)}
                placeholder={t("expenses.categoryPlaceholder")}
              />
            </div>
          )}

          {branches.length > 0 && (
            <div>
              <Label htmlFor="expenseBranch">{t("expenses.branch")} *</Label>
              <select
                id="expenseBranch"
                value={fields.branchId}
                onChange={(e) => update("branchId", e.target.value)}
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">{t("expenses.selectBranch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="expenseDescription">{t("expenses.description")}</Label>
            <Textarea
              id="expenseDescription"
              value={fields.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-xs text-status-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
