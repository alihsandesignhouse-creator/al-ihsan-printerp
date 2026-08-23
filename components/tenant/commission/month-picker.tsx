"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { buildRecentYearMonths } from "@/lib/utils/commission-math";

const MONTH_KEYS = [
  "months.jan",
  "months.feb",
  "months.mar",
  "months.apr",
  "months.may",
  "months.jun",
  "months.jul",
  "months.aug",
  "months.sep",
  "months.oct",
  "months.nov",
  "months.dec",
] as const;

interface MonthPickerProps {
  value: string; // yyyy-MM
  onChange: (yearMonth: string) => void;
  monthsBack?: number;
}

export function MonthPicker({ value, onChange, monthsBack = 12 }: MonthPickerProps) {
  const t = useTranslations();
  const months = buildRecentYearMonths(monthsBack).slice().reverse(); // most recent first

  function label(yearMonth: string): string {
    const [year, month] = yearMonth.split("-");
    const monthIndex = Number(month) - 1;
    const monthKey = MONTH_KEYS[monthIndex] ?? MONTH_KEYS[0]!;
    return `${t(monthKey)} ${year}`;
  }

  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("commission.selectMonth")}
        className="h-10 appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-9 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
      >
        {months.map((ym) => (
          <option key={ym} value={ym}>
            {label(ym)}
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
