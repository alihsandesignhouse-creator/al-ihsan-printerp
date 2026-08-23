"use client";

import { useTranslations } from "next-intl";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import { DateRangeFilter } from "@/components/tenant/reports/date-range-filter";
import { PAYMENT_METHODS } from "@/lib/types/order";
import type { PaymentMethod } from "@/lib/types/order";
import type { Branch } from "@/lib/types/dashboard";
import type { ReportDateRange } from "@/lib/types/report";

interface PaymentFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  methodId: PaymentMethod | "all";
  onMethodChange: (v: PaymentMethod | "all") => void;
  branches: Branch[];
  branchId: string | "all";
  onBranchChange: (v: string | "all") => void;
  range: ReportDateRange;
  onRangeChange: (range: ReportDateRange) => void;
}

/**
 * Module T-05 (audit item #3, /dashboard/payments): সার্চ (অর্ডার
 * নম্বর/গ্রাহকের নাম/মোবাইল) + তারিখ রেঞ্জ + পদ্ধতি + শাখা — blueprint-এ
 * উল্লেখিত "তারিখ/শাখা/পদ্ধতি/গ্রাহক ফিল্টার"। DateRangeFilter এখানে
 * T-18 রিপোর্ট পেজের সাথে হুবহু একই কম্পোনেন্ট পুনঃব্যবহার করা হয়েছে।
 */
export function PaymentFiltersBar(props: PaymentFiltersBarProps) {
  const t = useTranslations();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <Input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder={t("payments.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <div className="relative inline-block">
          <select
            value={props.methodId}
            onChange={(e) => props.onMethodChange(e.target.value as PaymentMethod | "all")}
            aria-label={t("orders.paymentMethodLabel")}
            className="h-10 appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-9 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all">{t("payments.allMethods")}</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`orders.paymentMethod.${m}`)}
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

      <DateRangeFilter range={props.range} onChange={props.onRangeChange} />
    </div>
  );
}
