"use client";

import { useTranslations } from "next-intl";
import { LayoutList, LayoutGrid, Columns3, ArrowUpDown, Calendar } from "lucide-react";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import type { Branch } from "@/lib/types/dashboard";
import type { Order } from "@/lib/types/order";
import { isOverdue } from "./pending-work-utils";

export type ViewMode = "table" | "card" | "kanban";
export type SortMode = "priority" | "date";

interface PendingWorkToolbarProps {
  orders: Order[];
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  sortMode: SortMode;
  onSortModeChange: (v: SortMode) => void;
  branches: Branch[];
  branchId: string | "all";
  onBranchChange: (v: string | "all") => void;
  isAdmin: boolean; // true for tenant_admin only
}

export function PendingWorkToolbar({
  orders,
  viewMode,
  onViewModeChange,
  sortMode,
  onSortModeChange,
  branches,
  branchId,
  onBranchChange,
  isAdmin,
}: PendingWorkToolbarProps) {
  const t = useTranslations();

  const overdueCount = orders.filter((o) => isOverdue(o)).length;
  const urgentCount = orders.filter((o) => o.isUrgent && !isOverdue(o)).length;
  const readyCount = orders.filter((o) => o.status === "ready").length;

  const statClass = "flex flex-col items-center rounded-lg border px-3 py-1.5 text-center";

  const viewBtnClass = (active: boolean) =>
    `flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
      active
        ? "bg-brand-primary text-white"
        : "text-neutral-500 hover:bg-neutral-100"
    }`;

  return (
    <div className="space-y-3">
      {/* ── Summary stat chips ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={`${statClass} border-neutral-200 bg-white`}>
          <span className="text-xs text-neutral-400">{t("pendingWork.totalOrders")}</span>
          <span className="text-lg font-bold text-neutral-800 leading-none">{orders.length}</span>
        </div>
        {overdueCount > 0 && (
          <div className={`${statClass} border-red-200 bg-red-50`}>
            <span className="text-xs text-red-500">{t("pendingWork.overdueCount")}</span>
            <span className="text-lg font-bold text-red-600 leading-none">{overdueCount}</span>
          </div>
        )}
        {urgentCount > 0 && (
          <div className={`${statClass} border-amber-200 bg-amber-50`}>
            <span className="text-xs text-amber-600">{t("pendingWork.urgentCount")}</span>
            <span className="text-lg font-bold text-amber-700 leading-none">{urgentCount}</span>
          </div>
        )}
        {readyCount > 0 && (
          <div className={`${statClass} border-emerald-200 bg-emerald-50`}>
            <span className="text-xs text-emerald-600">{t("pendingWork.readyCount")}</span>
            <span className="text-lg font-bold text-emerald-700 leading-none">{readyCount}</span>
          </div>
        )}
      </div>

      {/* ── Controls row ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Branch filter — tenant_admin only, hidden when single-branch */}
        {isAdmin && (
          <BranchFilter
            branches={branches}
            selectedBranchId={branchId}
            onChange={onBranchChange}
          />
        )}

        {/* Sort toggle */}
        <div className="flex h-9 items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => onSortModeChange("priority")}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
              sortMode === "priority"
                ? "bg-brand-primary text-white"
                : "text-neutral-500 hover:bg-neutral-100"
            }`}
            title={t("pendingWork.sortPriority")}
          >
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t("pendingWork.sortPriority")}</span>
          </button>
          <button
            type="button"
            onClick={() => onSortModeChange("date")}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
              sortMode === "date"
                ? "bg-brand-primary text-white"
                : "text-neutral-500 hover:bg-neutral-100"
            }`}
            title={t("pendingWork.sortDate")}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t("pendingWork.sortDate")}</span>
          </button>
        </div>

        {/* View mode toggle — desktop only */}
        <div className="hidden items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 lg:flex">
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={viewBtnClass(viewMode === "table")}
            title={t("pendingWork.viewTable")}
          >
            <LayoutList className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("card")}
            className={viewBtnClass(viewMode === "card")}
            title={t("pendingWork.viewCard")}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("kanban")}
            className={viewBtnClass(viewMode === "kanban")}
            title={t("pendingWork.viewKanban")}
          >
            <Columns3 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
