"use client";

import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatTaka } from "@/lib/utils/calculations";
import type { ZakatAssetLine } from "@/lib/types/zakat";

interface AmountListEditorProps {
  title: string;
  addLabel: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  emptyLabel: string;
  lines: ZakatAssetLine[];
  onChange: (lines: ZakatAssetLine[]) => void;
}

function newLine(): ZakatAssetLine {
  return { id: crypto.randomUUID(), name: "", amount: 0, description: "" };
}

/** ZK-01: "বাইরের সম্পদ" ও "বাদযোগ্য দেনা" — উভয়ই একই আকৃতি (নাম/টাকা/বিবরণ), তাই একটি সাধারণ কম্পোনেন্ট। */
export function AmountListEditor({
  title,
  addLabel,
  namePlaceholder,
  descriptionPlaceholder,
  emptyLabel,
  lines,
  onChange,
}: AmountListEditorProps) {
  const t = useTranslations();

  function addLine() {
    onChange([...lines, newLine()]);
  }

  function removeLine(id: string) {
    onChange(lines.filter((l) => l.id !== id));
  }

  function updateLine(id: string, patch: Partial<ZakatAssetLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span className="font-mono text-sm text-neutral-500">{formatTaka(total)}</span>
      </div>

      {lines.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-center text-sm text-neutral-500">
          {emptyLabel}
        </p>
      )}

      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 sm:flex-row sm:items-start">
            <Input
              value={line.name}
              onChange={(e) => updateLine(line.id, { name: e.target.value })}
              placeholder={namePlaceholder}
              className="sm:flex-1"
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              value={line.amount}
              onChange={(e) => updateLine(line.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
              placeholder={t("zakat.amount")}
              className="sm:w-36"
            />
            <Input
              value={line.description}
              onChange={(e) => updateLine(line.id, { description: e.target.value })}
              placeholder={descriptionPlaceholder}
              className="sm:flex-1"
            />
            <button
              type="button"
              onClick={() => removeLine(line.id)}
              aria-label={t("common.delete")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {addLabel}
      </Button>
    </div>
  );
}
