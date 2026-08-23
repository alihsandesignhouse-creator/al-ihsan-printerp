import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { computeCostCalculatorTotals, calcEffectiveRowTotal } from "@/lib/utils/cost-calculator-math";
import type {
  CostTemplate,
  CostTemplateFormData,
  CostCalculation,
  CostCalculationFormData,
} from "@/lib/types/cost-calculator";

// ─── Templates ──────────────────────────────────────────────────────────

/**
 * Real-time template list for a branch. Always excludes soft-deleted rows.
 * branchId is required — templates are branch-scoped (T-10 session decision).
 */
export function subscribeCostTemplates(
  tenantId: string,
  branchId: string,
  callback: (templates: CostTemplate[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "cost_templates");
  const q = query(
    colRef,
    where("branchId", "==", branchId),
    where("deletedAt", "==", null),
    orderBy("name", "asc")
  );
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CostTemplate)),
    onError
  );
}

export async function createCostTemplate(
  tenantId: string,
  userId: string,
  userName: string,
  input: CostTemplateFormData
): Promise<string> {
  const ref = doc(collection(db, "tenants", tenantId, "cost_templates"));
  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      id: ref.id,
      tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      categories: input.categories.map((c, index) => ({ name: c.name.trim(), order: index })),
      createdBy: userId,
      createdByName: userName,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return ref.id;
}

export async function softDeleteCostTemplate(tenantId: string, templateId: string, userId: string): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "cost_templates", templateId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("costing.templateNotFound");
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
}

// ─── Saved calculations (history) ──────────────────────────────────────

/**
 * Real-time saved-calculation history for a branch, most recent first.
 * Capped at 100 — this is a working reference list, not a full ledger.
 */
export function subscribeCostCalculations(
  tenantId: string,
  branchId: string,
  callback: (calculations: CostCalculation[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "cost_calculations");
  const q = query(
    colRef,
    where("branchId", "==", branchId),
    where("deletedAt", "==", null),
    orderBy("createdAt", "desc"),
    fsLimit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CostCalculation)),
    onError
  );
}

/**
 * Persists a full calculation snapshot. Totals are recomputed here (never
 * trusted from client state alone) using the same pure functions the live
 * calculator UI uses, so a saved record always matches its displayed totals.
 */
export async function saveCostCalculation(
  tenantId: string,
  userId: string,
  userName: string,
  input: CostCalculationFormData
): Promise<string> {
  const totals = computeCostCalculatorTotals({
    rows: input.categories,
    pieceQuantity: input.pieceQuantity,
    profitMarginPercent: input.profitMarginPercent,
  });

  const ref = doc(collection(db, "tenants", tenantId, "cost_calculations"));
  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      id: ref.id,
      tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      categories: input.categories.map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        total: calcEffectiveRowTotal(row.quantity, row.unitPrice, row.totalOverride ?? null),
      })),
      totalProductionCost: totals.totalProductionCost,
      pieceQuantity: input.pieceQuantity,
      costPerPiece: totals.costPerPiece,
      profitMarginPercent: input.profitMarginPercent,
      suggestedSellingPricePerPiece: totals.suggestedSellingPricePerPiece,
      suggestedSellingPriceTotal: totals.suggestedSellingPriceTotal,
      createdBy: userId,
      createdByName: userName,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return ref.id;
}

export async function softDeleteCostCalculation(tenantId: string, calcId: string, userId: string): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "cost_calculations", calcId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("costing.calculationNotFound");
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
}
