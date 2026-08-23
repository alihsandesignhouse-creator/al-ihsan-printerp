"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import type { Branch } from "@/lib/types/dashboard";
import type { QuotationStatusFilter } from "@/lib/types/quotation";

interface QuotationFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: QuotationStatusFilter;
  onStatusChange: (v: QuotationStatusFilter) => void;
  branches: Branch[];
  branchId: string | "all";
  onBranchChange: (v: string | "all") => void;
}

const STATUS_FILTERS: QuotationStatusFilter[] = ["all", "draft", "sent", "accepted", "rejected", "expired"];

export function QuotationFiltersBar(props: QuotationFiltersBarProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={t("quotations.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <select
        value={props.status}
        onChange={(e) => props.onStatusChange(e.target.value as QuotationStatusFilter)}
        className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
      >
        {STATUS_FILTERS.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? t("common.all") : t(`quotations.status.${s}`)}
          </option>
        ))}
      </select>

      <BranchFilter branches={props.branches} selectedBranchId={props.branchId} onChange={props.onBranchChange} />
    </div>
  );
}
