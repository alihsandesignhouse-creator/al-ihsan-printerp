import type { Timestamp } from "firebase/firestore";

// ─── Stock items (T-15 — standalone collection) ────────────────────────────
// /tenants/{tenantId}/stock_items/{stockId}

export type StockTransactionType = "in" | "out" | "adjustment";

export interface StockItem {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumLevel: number;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StockItemFormData {
  name: string;
  category: string;
  unit: string;
  branchId: string;
  openingStock: number;
  minimumLevel: number;
}

/** Fields editable after creation — branchId and opening stock are not re-editable here (changes go through transactions). */
export interface StockItemEditData {
  name: string;
  category: string;
  unit: string;
  minimumLevel: number;
}

// ─── Stock transactions (ledger, append-only) ──────────────────────────────
// /tenants/{tenantId}/stock_transactions/{txId}

export interface StockTransaction {
  id: string;
  tenantId: string;
  branchId: string;
  stockItemId: string;
  stockItemName: string;
  type: StockTransactionType;
  /** Signed change applied to currentStock (positive for in / positive adjustment, negative for out / negative adjustment) */
  delta: number;
  previousStock: number;
  newStock: number;
  note: string;
  performedBy: string;
  performedByName: string;
  createdAt: Timestamp;
}

export interface StockTransactionFormInput {
  type: StockTransactionType;
  /**
   * For "in" / "out": the quantity to add or remove (always entered as a positive number).
   * For "adjustment": the new absolute current-stock value being set.
   */
  amount: number;
  note: string;
}

// ─── List filters ───────────────────────────────────────────────────────

export interface StockListFilters {
  branchId: string | "all";
  search: string;
  lowStockOnly: boolean;
}

export const STOCK_TRANSACTION_TYPES: StockTransactionType[] = ["in", "out", "adjustment"];
