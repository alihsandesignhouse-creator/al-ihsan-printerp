"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatTaka, round2, deriveUnitPriceFromTotal } from "@/lib/utils/calculations";
import { computeCostCalculatorTotals, calcEffectiveRowTotal } from "@/lib/utils/cost-calculator-math";
import type { CostCategoryRow } from "@/lib/types/cost-calculator";
import type { Branch } from "@/lib/types/dashboard";

interface CostCalculatorFormProps {
  branches: Branch[];
  branchId: string;
  onBranchChange: (branchId: string) => void;
  rows: CostCategoryRow[];
  onRowsChange: (rows: CostCategoryRow[]) => void;
  pieceQuantity: number;
  onPieceQuantityChange: (value: number) => void;
  profitMarginPercent: number;
  onProfitMarginChange: (value: number) => void;
}

function newRow(): CostCategoryRow {
  return { id: crypto.randomUUID(), name: "", quantity: 0, unitPrice: 0, totalOverride: null };
}

export function CostCalculatorForm({
  branches,
  branchId,
  onBranchChange,
  rows,
  onRowsChange,
  pieceQuantity,
  onPieceQuantityChange,
  profitMarginPercent,
  onProfitMarginChange,
}: CostCalculatorFormProps) {
  const t = useTranslations();

  const totals = useMemo(
    () => computeCostCalculatorTotals({ rows, pieceQuantity, profitMarginPercent }),
    [rows, pieceQuantity, profitMarginPercent]
  );

  function addRow() {
    onRowsChange([...rows, newRow()]);
  }

  function removeRow(id: string) {
    onRowsChange(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<CostCategoryRow>) {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  /** User typed per-piece price directly — clears any earlier total
   *  override (৩০ জুলাই ২০২৬ ফিচার, see order-item-rows.tsx's identical
   *  handler for the full reasoning). */
  function handleUnitPriceChange(id: string, value: number) {
    updateRow(id, { unitPrice: Math.max(0, value || 0), totalOverride: null });
  }

  /** User typed the row TOTAL directly — becomes authoritative; unitPrice
   *  is only a derived, rounded display value. */
  function handleTotalChange(id: string, value: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const total = round2(Math.max(0, value || 0));
    updateRow(id, { totalOverride: total, unitPrice: deriveUnitPriceFromTotal(total, row.quantity || 0) });
  }

  /** Quantity changed — if total is pinned, keep it fixed and only
   *  re-derive unitPrice; otherwise normal quantity × unitPrice mode. */
  function handleQuantityChange(id: string, value: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const quantity = Math.max(0, value || 0);
    if (row.totalOverride !== null) {
      updateRow(id, { quantity, unitPrice: deriveUnitPriceFromTotal(row.totalOverride, quantity) });
    } else {
      updateRow(id, { quantity });
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-brand-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-neutral-900">{t("costing.calculatorTitle")}</h2>
        </div>

        {branches.length > 1 && (
          <div>
            <select
              value={branchId}
              onChange={(e) => onBranchChange(e.target.value)}
              aria-label={t("costing.branch")}
              className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Dynamic category rows */}
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-sm text-neutral-500">
            {t("costing.noCategoriesYet")}
          </p>
        )}

        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  placeholder={t("costing.categoryNamePlaceholder")}
                  aria-label={t("costing.categoryName")}
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-neutral-500">{t("costing.quantity")}</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) => handleQuantityChange(row.id, Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-500">{t("costing.unitPrice")}</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(e) => handleUnitPriceChange(row.id, Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-500">{t("costing.rowTotal")}</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={calcEffectiveRowTotal(row.quantity, row.unitPrice, row.totalOverride)}
                      onChange={(e) => handleTotalChange(row.id, Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.id)}
                title={t("common.delete")}
                aria-label={t("common.delete")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addRow} className="w-full">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("costing.addCategory")}
        </Button>
      </div>

      {/* Summary panel */}
      <div className="space-y-3 rounded-lg bg-neutral-50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">{t("costing.totalProductionCost")}</span>
          <span className="font-semibold text-neutral-900">{formatTaka(totals.totalProductionCost)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pieceQuantity">{t("costing.pieceQuantity")}</Label>
            <Input
              id="pieceQuantity"
              type="number"
              min={0}
              inputMode="numeric"
              value={pieceQuantity}
              onChange={(e) => onPieceQuantityChange(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div>
            <Label htmlFor="profitMargin">{t("costing.profitMargin")}</Label>
            <Input
              id="profitMargin"
              type="number"
              min={0}
              inputMode="decimal"
              value={profitMarginPercent}
              onChange={(e) => onProfitMarginChange(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">{t("costing.costPerPiece")}</span>
          <span className="font-medium text-neutral-900">{formatTaka(totals.costPerPiece)}</span>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
          <span className="font-medium text-neutral-700">{t("costing.suggestedPricePerPiece")}</span>
          <span className="text-base font-semibold text-brand-primary">
            {formatTaka(totals.suggestedSellingPricePerPiece)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">{t("costing.suggestedPriceTotal")}</span>
          <span className="font-medium text-neutral-900">{formatTaka(totals.suggestedSellingPriceTotal)}</span>
        </div>
      </div>
    </div>
  );
}
