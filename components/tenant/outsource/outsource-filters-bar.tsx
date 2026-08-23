"use client";

import { useTranslations } from "next-intl";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import { OUTSOURCE_STATUSES } from "@/lib/types/outsource";
import type { OutsourceStatus } from "@/lib/types/outsource";
import type { Branch } from "@/lib/types/dashboard";

interface OutsourceFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: OutsourceStatus | "all";
  onStatusChange: (v: OutsourceStatus | "all") => void;
  branches: Branch[];
  branchId: string | "all";
  onBranchChange: (v: string | "all") => void;
}

export function OutsourceFiltersBar(props: OutsourceFiltersBarProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={t("outsource.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div className="relative inline-block">
        <select
          value={props.status}
          onChange={(e) => props.onStatusChange(e.target.value as OutsourceStatus | "all")}
          aria-label={t("outsource.status")}
          className="h-10 appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-9 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        >
          <option value="all">{t("outsource.allStatuses")}</option>
          {OUTSOURCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`outsource.statusValue.${s}`)}
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
