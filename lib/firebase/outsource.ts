import {
  collection,
  doc,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { subscribePagedList, loadMorePagedList } from "./pagination-helpers";
import { round2 } from "@/lib/utils/calculations";
import { logAction } from "./audit";
import type { OutsourceRecord, OutsourceFormData } from "@/lib/types/outsource";

// ─── Outsource records (real-time) ─────────────────────────────────────────

/**
 * Real-time outsource record list, soonest expected-return first — matches
 * blueprint T-03's "মেয়াদ পেরিয়ে গেলে স্বয়ংক্রিয় লাল হাইলাইট" convention
 * (overdue rows are cheapest to spot when sorted this way). Always excludes
 * soft-deleted records. Same query shape as subscribeExpenses/subscribeStockItems.
 */
export function subscribeOutsourceRecords(
  tenantId: string,
  branchId: string | "all",
  callback: (records: OutsourceRecord[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "outsource_records");
  const constraints = branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return subscribePagedList<OutsourceRecord>(
    colRef,
    constraints,
    "expectedReturnDate",
    "asc",
    callback,
    (error) => onError(error as Error)
  );
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — outsource/page.tsx দেখুন। */
export async function loadMoreOutsourceRecords(
  tenantId: string,
  branchId: string | "all",
  lastRecord: Pick<OutsourceRecord, "id" | "expectedReturnDate">
): Promise<{ items: OutsourceRecord[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "outsource_records");
  const constraints = branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return loadMorePagedList<OutsourceRecord>(colRef, constraints, "expectedReturnDate", "asc", lastRecord.expectedReturnDate, lastRecord.id);
}

// ─── Create / edit / soft-delete ───────────────────────────────────────────

export async function createOutsourceRecord(
  tenantId: string,
  actor: { uid: string; name: string },
  input: OutsourceFormData
): Promise<string> {
  const ref = doc(collection(db, "tenants", tenantId, "outsource_records"));
  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      id: ref.id,
      tenantId,
      branchId: input.branchId,
      relatedOrderNumber: input.relatedOrderNumber.trim(),
      workDescription: input.workDescription.trim(),
      vendorName: input.vendorName.trim(),
      sentDate: Timestamp.fromDate(new Date(`${input.sentDate}T00:00:00`)),
      expectedReturnDate: Timestamp.fromDate(new Date(`${input.expectedReturnDate}T00:00:00`)),
      cost: round2(input.cost),
      status: input.status,
      createdBy: actor.uid,
      createdByName: actor.name,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  void logAction(tenantId, "outsource.created", "outsource_record", ref.id, {
    vendorName: input.vendorName.trim(),
    cost: round2(input.cost),
    status: input.status,
  });
  return ref.id;
}

export async function updateOutsourceRecord(
  tenantId: string,
  recordId: string,
  input: OutsourceFormData
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "outsource_records", recordId);
  let previous: { vendorName: string; cost: number; status: string } | null = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("outsource.notFound");
    const existing = snap.data() as OutsourceRecord;
    previous = { vendorName: existing.vendorName, cost: existing.cost, status: existing.status };

    tx.update(ref, {
      branchId: input.branchId,
      relatedOrderNumber: input.relatedOrderNumber.trim(),
      workDescription: input.workDescription.trim(),
      vendorName: input.vendorName.trim(),
      sentDate: Timestamp.fromDate(new Date(`${input.sentDate}T00:00:00`)),
      expectedReturnDate: Timestamp.fromDate(new Date(`${input.expectedReturnDate}T00:00:00`)),
      cost: round2(input.cost),
      status: input.status,
      updatedAt: serverTimestamp(),
    });
  });

  void logAction(tenantId, "outsource.updated", "outsource_record", recordId, {
    before: previous,
    after: { vendorName: input.vendorName.trim(), cost: round2(input.cost), status: input.status },
  });
}

export async function softDeleteOutsourceRecord(tenantId: string, recordId: string, userId: string): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "outsource_records", recordId);
  let vendorName = "";
  let cost = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("outsource.notFound");
    const existing = snap.data() as OutsourceRecord;
    vendorName = existing.vendorName;
    cost = existing.cost;
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
  void logAction(tenantId, "outsource.soft_deleted", "outsource_record", recordId, { vendorName, cost });
}
