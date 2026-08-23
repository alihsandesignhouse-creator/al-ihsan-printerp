import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getIdToken } from "firebase/auth";
import { db, auth } from "./client";
import { subscribePagedList, loadMorePagedList } from "./pagination-helpers";
import { round2 } from "@/lib/utils/calculations";
import type {
  StockItem,
  StockItemFormData,
  StockItemEditData,
  StockTransaction,
  StockTransactionFormInput,
} from "@/lib/types/stock";

// ─── Stock items (real-time) ───────────────────────────────────────────────

/**
 * Real-time stock item list subscription. Always excludes soft-deleted items.
 * Branch filtering for Tenant Admin happens here; Branch Manager scoping is
 * additionally enforced server-side by Firebase Security Rules.
 */
export function subscribeStockItems(
  tenantId: string,
  branchId: string | "all",
  callback: (items: StockItem[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "stock_items");
  const constraints = branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return subscribePagedList<StockItem>(colRef, constraints, "name", "asc", callback, onError);
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — stock/page.tsx দেখুন। */
export async function loadMoreStockItems(
  tenantId: string,
  branchId: string | "all",
  lastItem: Pick<StockItem, "id" | "name">
): Promise<{ items: StockItem[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "stock_items");
  const constraints = branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return loadMorePagedList<StockItem>(colRef, constraints, "name", "asc", lastItem.name, lastItem.id);
}

export function subscribeStockItem(
  tenantId: string,
  stockId: string,
  callback: (item: StockItem | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "tenants", tenantId, "stock_items", stockId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as StockItem) : null),
    onError
  );
}

export async function getStockItemOnce(tenantId: string, stockId: string): Promise<StockItem | null> {
  const snap = await getDoc(doc(db, "tenants", tenantId, "stock_items", stockId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as StockItem) : null;
}

// ─── Create / edit / soft-delete stock item ────────────────────────────────

export async function createStockItem(
  tenantId: string,
  input: StockItemFormData
): Promise<string> {
  const itemRef = doc(collection(db, "tenants", tenantId, "stock_items"));
  await runTransaction(db, async (tx) => {
    tx.set(itemRef, {
      id: itemRef.id,
      tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      category: input.category.trim(),
      unit: input.unit.trim(),
      currentStock: round2(input.openingStock),
      minimumLevel: round2(input.minimumLevel),
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return itemRef.id;
}

export async function updateStockItem(
  tenantId: string,
  stockId: string,
  input: StockItemEditData
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "stock_items", stockId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("stock.notFound");
    tx.update(ref, {
      name: input.name.trim(),
      category: input.category.trim(),
      unit: input.unit.trim(),
      minimumLevel: round2(input.minimumLevel),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function softDeleteStockItem(
  tenantId: string,
  stockId: string,
  userId: string
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "stock_items", stockId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("stock.notFound");
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
}

// ─── Stock transactions (Stock In / Stock Out / Adjustment) ───────────────

/**
 * Records a stock transaction and atomically updates the parent item's
 * currentStock inside a Firestore transaction, mirroring the additive /
 * atomic-write pattern used for order payments (blueprint section 5.4).
 *
 * - "in": delta = +amount
 * - "out": delta = -amount (rejected if it would push currentStock below 0)
 * - "adjustment": amount is the new absolute stock value; delta is derived
 */
export async function recordStockTransaction(
  tenantId: string,
  userId: string,
  userName: string,
  stockId: string,
  input: StockTransactionFormInput
): Promise<void> {
  const itemRef = doc(db, "tenants", tenantId, "stock_items", stockId);

  // Capture crossing data from inside the transaction so we can fire the
  // low-stock notification after commit (Direct-Call Pattern, Free Edition).
  type CrossingInfo = {
    crossed: boolean;
    branchId: string;
    itemName: string;
    newStock: number;
    unit: string;
  };

  const crossingInfo = await runTransaction<CrossingInfo>(db, async (tx) => {
    const snap = await tx.get(itemRef);
    if (!snap.exists()) throw new Error("stock.notFound");
    const item = snap.data() as StockItem;
    const previousStock = item.currentStock;
    const minimumLevel = item.minimumLevel ?? 0;

    let delta: number;
    if (input.type === "in") {
      delta = round2(input.amount);
    } else if (input.type === "out") {
      delta = round2(-input.amount);
    } else {
      delta = round2(input.amount - previousStock);
    }

    const newStock = round2(previousStock + delta);
    if (newStock < 0) {
      throw new Error("stock.insufficientStock");
    }

    tx.update(itemRef, { currentStock: newStock, updatedAt: serverTimestamp() });

    const txRef = doc(collection(db, "tenants", tenantId, "stock_transactions"));
    tx.set(txRef, {
      id: txRef.id,
      tenantId,
      branchId: item.branchId,
      stockItemId: stockId,
      stockItemName: item.name,
      type: input.type,
      delta,
      previousStock,
      newStock,
      note: input.note.trim(),
      performedBy: userId,
      performedByName: userName,
      createdAt: serverTimestamp(),
    });

    // Evaluate the "crossing from >= minimumLevel to < minimumLevel"
    // condition here (same logic as the Cloud Function trigger) so it's
    // computed atomically with the stock write.
    const wasAboveOrEqual = previousStock >= minimumLevel;
    const isNowBelow = newStock < minimumLevel;

    return {
      crossed: wasAboveOrEqual && isNowBelow,
      branchId: item.branchId,
      itemName: item.name,
      newStock,
      unit: item.unit ?? "",
    };
  });

  // Direct-Call Pattern: fire notification after successful commit.
  // Best-effort — never throws, never blocks the UI.
  if (crossingInfo.crossed) {
    void fireLowStockNotification(tenantId, stockId, crossingInfo);
  }
}

/**
 * Sends the low-stock notification to the API route.
 * Called only when stock crosses from >= minimumLevel to < minimumLevel.
 * Exported for potential retry scenarios.
 */
export async function fireLowStockNotification(
  tenantId: string,
  stockId: string,
  info: { branchId: string; itemName: string; newStock: number; unit: string }
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  let token: string;
  try {
    token = await getIdToken(currentUser);
  } catch {
    return;
  }

  try {
    await fetch("/api/notifications/low-stock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        stockId,
        branchId: info.branchId,
        itemName: info.itemName,
        currentStock: info.newStock,
        unit: info.unit,
      }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[stock] fireLowStockNotification failed:", err);
    }
  }
}

export function subscribeStockTransactions(
  tenantId: string,
  stockId: string,
  callback: (transactions: StockTransaction[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "stock_transactions");
  const q = query(colRef, where("stockItemId", "==", stockId), orderBy("createdAt", "desc"), fsLimit(200));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as StockTransaction)),
    onError
  );
}
