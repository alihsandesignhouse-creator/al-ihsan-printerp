"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AUDIT_CATEGORIES, type AuditCategory } from "@/lib/types/audit";

interface AuditLogFiltersBarProps {
  category: AuditCategory | "all";
  onCategoryChange: (v: AuditCategory | "all") => void;
  from: string;
  onFromChange: (v: string) => void;
  to: string;
  onToChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function AuditLogFiltersBar(props: AuditLogFiltersBarProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={props.category}
        onChange={(e) => props.onCategoryChange(e.target.value as AuditCategory | "all")}
        className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
      >
        <option value="all">{t("auditLog.category.all")}</option>
        {AUDIT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(`auditLog.category.${c}`)}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-sm text-neutral-500">
        {t("auditLog.filterFrom")}
        <input
          type="date"
          value={props.from}
          onChange={(e) => props.onFromChange(e.target.value)}
          className="h-10 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
      </label>

      <label className="flex items-center gap-1.5 text-sm text-neutral-500">
        {t("auditLog.filterTo")}
        <input
          type="date"
          value={props.to}
          onChange={(e) => props.onToChange(e.target.value)}
          className="h-10 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
      </label>

      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={t("auditLog.searchPlaceholder")}
          className="pl-9"
        />
      </div>
    </div>
  );
}
