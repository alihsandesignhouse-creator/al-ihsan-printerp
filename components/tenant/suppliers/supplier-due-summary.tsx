"use client";

import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { Supplier } from "@/lib/types/supplier";

interface SupplierDueSummaryProps {
  suppliers: Supplier[];
}

export function SupplierDueSummary({ suppliers }: SupplierDueSummaryProps) {
  const t = useTranslations();
  const totalDue = suppliers.reduce((sum, s) => sum + Math.max(0, s.currentDue), 0);
  const dueCount = suppliers.filter((s) => s.currentDue > 0).length;

  if (dueCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <Wallet className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
      <p className="text-sm font-medium text-blue-800">
        {t("suppliers.totalPayableDue", { count: dueCount, amount: formatTaka(totalDue) })}
      </p>
    </div>
  );
}
