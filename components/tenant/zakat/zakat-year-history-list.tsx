"use client";

import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { ZakatYear } from "@/lib/types/zakat";

interface ZakatYearHistoryListProps {
  years: ZakatYear[];
}

/** ব্লুপ্রিন্ট Hawl ট্র্যাকার — সম্পন্ন হওয়া পূর্ববর্তী বছরগুলোর সংক্ষিপ্ত ইতিহাস (read-only)। */
export function ZakatYearHistoryList({ years }: ZakatYearHistoryListProps) {
  const t = useTranslations();

  if (years.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
        <History className="h-4 w-4" aria-hidden="true" />
        {t("zakat.previousYears")}
      </h2>
      <div className="space-y-2">
        {years.map((year) => (
          <div
            key={year.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm"
          >
            <span className="font-medium text-neutral-900">{t("zakat.hijriYearLabel", { year: year.hijriYear })}</span>
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
              <span>
                {t("zakat.zakatDue")}: <span className="font-mono text-neutral-700">{formatTaka(year.zakatDue)}</span>
              </span>
              <span>
                {t("zakat.paid")}: <span className="font-mono text-emerald-600">{formatTaka(year.zakatPaid)}</span>
              </span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600">
                {t("zakat.statusCompleted")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
