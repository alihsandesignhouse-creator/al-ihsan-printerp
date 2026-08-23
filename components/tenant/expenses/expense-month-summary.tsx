"use client";

import { useTranslations } from "next-intl";
import { Receipt } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { Expense } from "@/lib/types/expense";

interface ExpenseMonthSummaryProps {
  expenses: Expense[];
}

/**
 * বর্তমানে ফিল্টার করা তালিকার (নির্বাচিত মাস/শাখা/ক্যাটাগরি) মোট খরচ দেখায় —
 * blueprint T-18-এর গভীর বিশ্লেষণ (ক্যাটাগরিওয়ারি পাই চার্ট ইত্যাদি) থেকে
 * ইচ্ছাকৃতভাবে আলাদা রাখা হয়েছে, এখানে শুধু একটি হালকা সারসংক্ষেপ কার্ড
 * (SupplierDueSummary-এর সমান্তরাল প্যাটার্ন)।
 */
export function ExpenseMonthSummary({ expenses }: ExpenseMonthSummaryProps) {
  const t = useTranslations();
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <Receipt className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
      <p className="text-sm font-medium text-blue-800">
        {t("expenses.monthTotal", { count: expenses.length, amount: formatTaka(total) })}
      </p>
    </div>
  );
}
