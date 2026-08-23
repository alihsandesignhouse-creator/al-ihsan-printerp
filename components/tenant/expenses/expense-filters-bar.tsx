"use client";

import { useTranslations } from "next-intl";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import { MonthPicker } from "@/components/tenant/commission/month-picker";
import type { Branch } from "@/lib/types/dashboard";
import type { ExpenseCategory } from "@/lib/types/expense";

interface ExpenseFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  categories: ExpenseCategory[];
  categoryId: string | "all";
  onCategoryChange: (v: string | "all") => void;
  branches: Branch[];
  branchId: string | "all";
  onBranchChange: (v: string | "all") => void;
  month: string;
  onMonthChange: (v: string) => void;
}

export function ExpenseFiltersBar(props: ExpenseFiltersBarProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={t("expenses.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <MonthPicker value={props.month} onChange={props.onMonthChange} monthsBack={12} />

      <div className="relative inline-block">
        <select
          value={props.categoryId}
          onChange={(e) => props.onCategoryChange(e.target.value)}
          aria-label={t("expenses.category")}
          className="h-10 appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-9 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        >
          <option value="all">{t("expenses.allCategories")}</option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.isSystem ? t("expenses.staffPaymentCategory") : c.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
      </div>

      <BranchFilter branches={props.branches} selectedBranchId={props.branchId} onChange={props.onBranchChange} />
    </div>
  );
}
