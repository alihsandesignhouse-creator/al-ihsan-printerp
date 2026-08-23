"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import type { ReportDateRange, ReportRangePreset } from "@/lib/types/report";

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** প্রিসেট → তারিখ রেঞ্জ। "custom" নিজে কল করে না — page.tsx-এ ইনপুট থেকে সরাসরি বসানো হয়। */
export function buildPresetRange(preset: Exclude<ReportRangePreset, "custom">): ReportDateRange {
  const now = new Date();
  if (preset === "thisMonth") {
    return {
      start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: endOfDay(now),
      preset,
    };
  }
  if (preset === "lastMonth") {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: startOfDay(lastMonthStart), end: endOfDay(lastMonthEnd), preset };
  }
  // thisYear
  return {
    start: startOfDay(new Date(now.getFullYear(), 0, 1)),
    end: endOfDay(now),
    preset,
  };
}

interface DateRangeFilterProps {
  range: ReportDateRange;
  onChange: (range: ReportDateRange) => void;
}

const PRESETS: Exclude<ReportRangePreset, "custom">[] = ["thisMonth", "lastMonth", "thisYear"];

export function DateRangeFilter({ range, onChange }: DateRangeFilterProps) {
  const t = useTranslations();

  function handlePresetClick(preset: Exclude<ReportRangePreset, "custom">) {
    onChange(buildPresetRange(preset));
  }

  function handleCustomStart(value: string) {
    if (!value) return;
    onChange({ start: startOfDay(new Date(`${value}T00:00:00`)), end: range.end, preset: "custom" });
  }

  function handleCustomEnd(value: string) {
    if (!value) return;
    onChange({ start: range.start, end: endOfDay(new Date(`${value}T00:00:00`)), preset: "custom" });
  }

  return (
    <div data-print-hide className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handlePresetClick(preset)}
            className={`h-9 rounded-lg px-3 text-sm font-medium transition-colors ${
              range.preset === preset
                ? "bg-brand-primary text-white"
                : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {t(`reports.preset.${preset}`)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label={t("reports.startDate")}
          value={toIsoDateLocal(range.start)}
          onChange={(e) => handleCustomStart(e.target.value)}
          className="h-9 w-[150px]"
        />
        <span className="text-sm text-neutral-400">{t("reports.dateRangeSeparator")}</span>
        <Input
          type="date"
          aria-label={t("reports.endDate")}
          value={toIsoDateLocal(range.end)}
          onChange={(e) => handleCustomEnd(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
    </div>
  );
}
