import {
  collection,
  doc,
  query,
  where,
  limit as fsLimit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { calcTotalCosting } from "@/lib/utils/order-costing-math";
import type { OrderCosting, OrderCostingFormData } from "@/lib/types/order-costing";

/** Real-time subscription to a single order's costing record (doc ID == orderId). */
export function subscribeOrderCosting(
  tenantId: string,
  orderId: string,
  callback: (costing: OrderCosting | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "tenants", tenantId, "order_costings", orderId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as OrderCosting) : null),
    onError
  );
}

/**
 * Creates or overwrites the costing record for an order, and atomically flags
 * the parent order document with `hasCosting: true` in the same transaction
 * (used by the order list to mark orders still missing costing — blueprint
 * T-11: "কস্টিং ছাড়া অর্ডার আলাদাভাবে চিহ্নিত"). `createdAt` is preserved
 * across edits; only `updatedAt` changes on subsequent saves.
 */
export async function saveOrderCosting(
  tenantId: string,
  userId: string,
  userName: string,
  order: { id: string; branchId: string; orderNumber: string },
  input: OrderCostingFormData
): Promise<void> {
  const totalCosting = calcTotalCosting(input.rawMaterialCost, input.laborCost, input.otherCost);
  const costingRef = doc(db, "tenants", tenantId, "order_costings", order.id);
  const orderRef = doc(db, "tenants", tenantId, "orders", order.id);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(costingRef);

    tx.set(costingRef, {
      id: order.id,
      tenantId,
      branchId: order.branchId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      rawMaterialCost: input.rawMaterialCost,
      laborCost: input.laborCost,
      otherCost: input.otherCost,
      totalCosting,
      sourceCalculationId: input.sourceCalculationId,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      // এই ফাংশন সাপ্লায়ার-লেজার লিংক স্পর্শ করে না — সেটা শুধু
      // lib/firebase/suppliers.ts::linkCostingToSupplierLedger()-এর কাজ,
      // তাই বিদ্যমান মান (থাকলে) সবসময় অপরিবর্তিত রাখা হয়।
      supplierTransactionId: existing.exists() ? (existing.data()!.supplierTransactionId ?? null) : null,
      note: input.note.trim(),
      enteredBy: userId,
      enteredByName: userName,
      createdAt: existing.exists() ? existing.data()!.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.update(orderRef, { hasCosting: true, updatedAt: serverTimestamp() });
  });
}

/**
 * Fetches (once, live) every order-costing entry tagged with a given
 * supplier — used by the supplier detail page's "কস্টিং থেকে ক্রয়" tab
 * (১৬ আগস্ট ২০২৬)। Sorted client-side by createdAt desc to avoid needing a
 * new composite index (supplierId equality + createdAt order would require
 * one) — bounded to 300 entries, matching the T-18 item-analysis cap
 * precedent for collections without a dedicated composite index.
 */
export function subscribeCostingsBySupplier(
  tenantId: string,
  supplierId: string,
  callback: (costings: OrderCosting[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "order_costings");
  const q = query(colRef, where("supplierId", "==", supplierId), fsLimit(300));

  return onSnapshot(
    q,
    (snapshot) => {
      const costings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderCosting);
      costings.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      callback(costings);
    },
    (error) => onError(error as Error)
  );
}
