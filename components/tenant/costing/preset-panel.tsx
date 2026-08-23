"use client";

import { useTranslations, useLocale } from "next-intl";
import { FileText, Image as ImageIcon, CreditCard, BookOpen, LayoutTemplate } from "lucide-react";
import { COST_CALCULATOR_PRESETS } from "@/lib/data/cost-calculator-presets";
import type { CostCalculatorPreset } from "@/lib/data/cost-calculator-presets";

const PRESET_ICONS: Record<string, typeof FileText> = {
  general: FileText,
  banner: ImageIcon,
  card: CreditCard,
  book: BookOpen,
};

interface PresetPanelProps {
  onLoadPreset: (preset: CostCalculatorPreset) => void;
}

/**
 * Module T-10 (audit item #৫): "৩-৪টা বিল্ট-ইন ডিফল্ট টেমপ্লেট রেডি
 * রাখা... 'নতুন থেকে শুরু' অপশনও থাকবে পাশাপাশি" — পেজের উপরে আগে থেকেই
 * থাকা "নতুন হিসাব" বাটনই "নতুন থেকে শুরু" অপশন হিসেবে কাজ করে (এই
 * প্যানেল সেটাকে প্রতিস্থাপন করে না, পাশাপাশি একটা বাড়তি দ্রুত-শুরুর
 * পথ দেয়)।
 */
export function PresetPanel({ onLoadPreset }: PresetPanelProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-1.5">
        <LayoutTemplate className="h-4 w-4 text-brand-accent" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-neutral-900">{t("costing.quickStart")}</h2>
      </div>
      <p className="mt-1 text-xs text-neutral-500">{t("costing.quickStartNote")}</p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {COST_CALCULATOR_PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset.key] ?? FileText;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => onLoadPreset(preset)}
              className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-sm font-medium text-neutral-700 hover:border-brand-primary hover:bg-blue-50 hover:text-brand-primary"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t(preset.labelKey)}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-neutral-400">
        {t("costing.quickStartHint", {
          example: locale === "bn" ? preview(COST_CALCULATOR_PRESETS[0]!, "bn") : preview(COST_CALCULATOR_PRESETS[0]!, "en"),
        })}
      </p>
    </div>
  );
}

function preview(preset: CostCalculatorPreset, locale: "bn" | "en"): string {
  return preset.categoryNames
    .slice(0, 3)
    .map((c) => c[locale])
    .join(", ");
}
