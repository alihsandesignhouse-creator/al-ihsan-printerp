"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { Branch } from "@/lib/types/dashboard";

interface BranchFilterProps {
  branches: Branch[];
  selectedBranchId: string | "all";
  onChange: (branchId: string | "all") => void;
  /** বাগ-ফিক্স (২১ আগস্ট ২০২৬): মোবাইলে order-filters-bar.tsx-এর ৩-কলাম
   * গ্রিডে এই সিলেক্টকে পূর্ণ-প্রস্থ করার জন্য ঐচ্ছিক className — ডিফল্ট
   * খালি রাখলে আগের মতোই auto-width (`inline-block`) আচরণ করে। */
  className?: string;
}

/**
 * [সব শাখা ▼] dropdown shown only to Tenant Admin per blueprint T-01.
 * Hidden entirely if the tenant has 0 or 1 branches (multi-branch is Standard+).
 */
export function BranchFilter({ branches, selectedBranchId, onChange, className = "" }: BranchFilterProps) {
  const t = useTranslations();

  if (branches.length <= 1) return null;

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={selectedBranchId}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("dashboard.branchFilter")}
        className="h-10 w-full appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-9 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
      >
        <option value="all">{t("common.allBranches")}</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        aria-hidden="true"
      />
    </div>
  );
}
