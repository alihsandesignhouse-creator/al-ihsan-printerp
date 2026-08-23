import { round2 } from "@/lib/utils/calculations";

/**
 * প্রতি বিভাগের মোট = পরিমাণ × একক মূল্য
 */
export function calcRowTotal(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

/**
 * ৩০ জুলাই ২০২৬ ফিচার — row-এ totalOverride (ব্যবহারকারীর সরাসরি টাইপ করা
 * মোট) থাকলে সেটাই ব্যবহার হয়, quantity × unitPrice দিয়ে আবার হিসাব করা হয়
 * না (lib/utils/calculations.ts's calcEffectiveLineTotal()-এর অনুরূপ)।
 */
export function calcEffectiveRowTotal(quantity: number, unitPrice: number, totalOverride: number | null): number {
  return totalOverride ?? calcRowTotal(quantity, unitPrice);
}

/**
 * মোট উৎপাদন খরচ = সব বিভাগের মোটের যোগফল
 */
export function calcTotalProductionCost(
  rows: { quantity: number; unitPrice: number; totalOverride?: number | null }[]
): number {
  return round2(
    rows.reduce((sum, row) => sum + calcEffectiveRowTotal(row.quantity, row.unitPrice, row.totalOverride ?? null), 0)
  );
}

/**
 * প্রতি পিসের খরচ = মোট উৎপাদন খরচ ÷ পরিমাণ (পিস)
 */
export function calcCostPerPiece(totalProductionCost: number, pieceQuantity: number): number {
  if (!pieceQuantity || pieceQuantity <= 0) return 0;
  return round2(totalProductionCost / pieceQuantity);
}

/**
 * মার্কআপ-অন-কস্ট পদ্ধতি (ব্লুপ্রিন্ট T-10 উদাহরণ: ৳৭,০০০ × (১ + ৩০/১০০) = ৳৯,১০০)
 */
export function calcSuggestedSellingPriceTotal(totalProductionCost: number, profitMarginPercent: number): number {
  return round2(totalProductionCost * (1 + profitMarginPercent / 100));
}

export function calcSuggestedSellingPricePerPiece(costPerPiece: number, profitMarginPercent: number): number {
  return round2(costPerPiece * (1 + profitMarginPercent / 100));
}

export interface CostCalculatorTotals {
  totalProductionCost: number;
  costPerPiece: number;
  suggestedSellingPricePerPiece: number;
  suggestedSellingPriceTotal: number;
}

export function computeCostCalculatorTotals(params: {
  rows: { quantity: number; unitPrice: number; totalOverride?: number | null }[];
  pieceQuantity: number;
  profitMarginPercent: number;
}): CostCalculatorTotals {
  const totalProductionCost = calcTotalProductionCost(params.rows);
  const costPerPiece = calcCostPerPiece(totalProductionCost, params.pieceQuantity);
  const suggestedSellingPriceTotal = calcSuggestedSellingPriceTotal(totalProductionCost, params.profitMarginPercent);
  const suggestedSellingPricePerPiece = calcSuggestedSellingPricePerPiece(costPerPiece, params.profitMarginPercent);
  return { totalProductionCost, costPerPiece, suggestedSellingPricePerPiece, suggestedSellingPriceTotal };
}
