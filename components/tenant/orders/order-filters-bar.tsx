"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import type { Branch } from "@/lib/types/dashboard";
import type { OrderStatusFilter, StaffOption } from "@/lib/types/order";

interface OrderFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: OrderStatusFilter;
  onStatusChange: (v: OrderStatusFilter) => void;
  branches: Branch[];
  branchId: string | "all";
  onBranchChange: (v: string | "all") => void;
  staffOptions: StaffOption[];
  staffId: string | "all";
  onStaffChange: (v: string | "all") => void;
  dueOnly: boolean;
  onDueOnlyChange: (v: boolean) => void;
}

const STATUS_FILTERS: OrderStatusFilter[] = ["all", "pending", "in_progress", "ready", "delivered", "cancelled"];

export function OrderFiltersBar(props: OrderFiltersBarProps) {
  const t = useTranslations();

  return (
    // বাগ-ফিক্স (২১ আগস্ট ২০২৬, ব্যবহারকারীর ফিডব্যাক): আগে সব ফিল্টার
    // একসাথে flex-wrap করত, মোবাইলে এলোমেলোভাবে ভাঙত। এখন মোবাইলে
    // (sm-এর নিচে) সার্চ/স্ট্যাটাস আলাদা পূর্ণ-প্রস্থ সারিতে, আর
    // শাখা/স্টাফ/শুধু-বকেয়া — এই তিনটা একটা সমান ৩-কলামের সারিতে।
    // sm+ স্ক্রিনে (ডেস্কটপ) আগের মতোই একই লাইনে flex-wrap।
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative sm:min-w-[220px] sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={t("orders.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <select
        value={props.status}
        onChange={(e) => props.onStatusChange(e.target.value as OrderStatusFilter)}
        className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary sm:w-auto"
      >
        {STATUS_FILTERS.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? t("common.all") : t(`orders.status.${s}`)}
          </option>
        ))}
      </select>

      {/* শাখা / স্টাফ / শুধু-বকেয়া — মোবাইলে সমান ৩-কলাম গ্রিড, sm+ এ স্বাভাবিক flex-item */}
      <div className="grid grid-cols-3 gap-2 sm:contents">
        <BranchFilter
          branches={props.branches}
          selectedBranchId={props.branchId}
          onChange={props.onBranchChange}
          className="w-full sm:w-auto"
        />

        <select
          value={props.staffId}
          onChange={(e) => props.onStaffChange(e.target.value)}
          className="h-10 w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary sm:w-auto sm:px-3 sm:text-sm"
        >
          <option value="all">{t("orders.allStaff")}</option>
          {props.staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700 sm:justify-start sm:px-3 sm:text-sm">
          <input
            type="checkbox"
            checked={props.dueOnly}
            onChange={(e) => props.onDueOnlyChange(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
          />
          <span className="truncate">{t("orders.dueOnly")}</span>
        </label>
      </div>
    </div>
  );
}
