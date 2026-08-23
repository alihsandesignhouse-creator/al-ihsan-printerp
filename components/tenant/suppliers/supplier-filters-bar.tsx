"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import type { Branch } from "@/lib/types/dashboard";

interface SupplierFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  branches: Branch[];
  branchId: string | "all";
  onBranchChange: (v: string | "all") => void;
  dueOnly: boolean;
  onDueOnlyChange: (v: boolean) => void;
}

export function SupplierFiltersBar(props: SupplierFiltersBarProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={t("suppliers.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <BranchFilter branches={props.branches} selectedBranchId={props.branchId} onChange={props.onBranchChange} />

      <label className="flex h-10 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700">
        <input
          type="checkbox"
          checked={props.dueOnly}
          onChange={(e) => props.onDueOnlyChange(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
        />
        {t("suppliers.dueOnly")}
      </label>
    </div>
  );
}
