import type { Timestamp } from "firebase/firestore";

// ─── Cost Calculator — Module T-10 (স্ট্যান্ডার্ড+) ────────────────────────
// Fully dynamic, user-defined cost categories — no fixed category list, per
// ব্লুপ্রিন্ট অংশ ৯ / মডিউল T-10. Scoped per branch (branchId required),
// matching T-15/T-16's branch-scoped pattern.

/** A single row in the live calculator UI (client-side state, not persisted directly). */
export interface CostCategoryRow {
  id: string; // client-generated key (crypto.randomUUID()), used for React keys and reordering
  name: string;
  quantity: number;
  unitPrice: number;
  /** ৩০ জুলাই ২০২৬ ফিচার — see lib/utils/calculations.ts's
   *  calcEffectiveLineTotal() and OrderItemFormRow's identical field. */
  totalOverride: number | null;
}

// ─── Templates ──────────────────────────────────────────────────────────
// /tenants/{tenantId}/cost_templates/{templateId}
// Stores category *names* only — quantity/unitPrice always start blank when
// a template is loaded ("বিভাগের নামগুলো সংরক্ষণ, পরিমাণ ও মূল্য খালি থাকে").

export interface CostTemplateCategory {
  name: string;
  order: number;
}

export interface CostTemplate {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  categories: CostTemplateCategory[];
  createdBy: string;
  createdByName: string;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CostTemplateFormData {
  name: string;
  branchId: string;
  categories: CostTemplateCategory[];
}

// ─── Saved calculations (history) ──────────────────────────────────────
// /tenants/{tenantId}/cost_calculations/{calcId}
// A full snapshot of a completed calculation, kept for future reference.
// Standalone in this module for now — T-11 (উৎপাদন কস্টিং) and T-14
// (কোটেশন) will read from these once built, via their own "আমদানি" flows.

export interface CostCalculationCategory {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CostCalculation {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  categories: CostCalculationCategory[];
  totalProductionCost: number;
  pieceQuantity: number;
  costPerPiece: number;
  profitMarginPercent: number;
  suggestedSellingPricePerPiece: number;
  suggestedSellingPriceTotal: number;
  createdBy: string;
  createdByName: string;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CostCalculationFormData {
  name: string;
  branchId: string;
  categories: CostCategoryRow[];
  pieceQuantity: number;
  profitMarginPercent: number;
}
