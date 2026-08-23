"use client";

import { useTranslations } from "next-intl";
import { Calculator } from "lucide-react";
import { Label } from "@/components/ui/label";
import { formatTaka } from "@/lib/utils/calculations";
import type { CostCalculation } from "@/lib/types/cost-calculator";

interface ImportFromCalculatorProps {
  calculations: CostCalculation[];
  onImport: (calculation: CostCalculation) => void;
}

/**
 * blueprint T-14: "[কস্ট ক্যালকুলেটর থেকে আমদানি]"। একটি সংরক্ষিত T-10
 * ক্যালকুলেশন বেছে নিলে সেটা একটা নতুন quotation আইটেম রো হিসেবে যোগ হয় —
 * নাম = ক্যালকুলেশনের নাম, পরিমাণ = pieceQuantity, একক মূল্য =
 * suggestedSellingPricePerPiece (T-11 order-costing-section.tsx-এর
 * import প্যাটার্নের সাথে সামঞ্জস্যপূর্ণ, কিন্তু itemized হওয়ায় এখানে পুরো
 * ক্যালকুলেশনটাই এক লাইন আইটেম হিসেবে যোগ হয়, খরচ ফিল্ড প্রতিস্থাপনের বদলে)।
 */
export function ImportFromCalculator({ calculations, onImport }: ImportFromCalculatorProps) {
  const t = useTranslations();

  if (calculations.length === 0) return null;

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Calculator className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
        <Label className="!mb-0 text-xs text-neutral-500">{t("quotations.importFromCalculator")}</Label>
      </div>
      <select
        value=""
        onChange={(e) => {
          const calc = calculations.find((c) => c.id === e.target.value);
          if (calc) onImport(calc);
          e.target.value = "";
        }}
        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
      >
        <option value="">{t("quotations.selectCalculationToImport")}</option>
        {calculations.map((calc) => (
          <option key={calc.id} value={calc.id}>
            {calc.name} — {formatTaka(calc.suggestedSellingPricePerPiece)}/{t("quotations.perPiece")}
          </option>
        ))}
      </select>
    </div>
  );
}
