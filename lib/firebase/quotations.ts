import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { subscribePagedList, loadMorePagedList } from "./pagination-helpers";
import { calcEffectiveLineTotal, calcSubtotal, buildItemSummary, round2 } from "@/lib/utils/calculations";
import type {
  Quotation,
  QuotationItem,
  QuotationStatus,
  NewQuotationFormInput,
} from "@/lib/types/quotation";

// ─── Temporary offline numbering, mirrors buildOfflineOrderNumber (T-02) ───
function buildOfflineQuotationNumber(): string {
  return `OFFLINE-${Date.now()}`;
}

export function isOfflineQuotationNumber(quotationNumber: string): boolean {
  return quotationNumber.startsWith("OFFLINE-");
}

// ─── Quotation list (real-time) ─────────────────────────────────────────

export interface QuotationSubscriptionFilters {
  branchId: string | "all";
  status: QuotationStatus | "all";
}

export function subscribeToQuotations(
  tenantId: string,
  filters: QuotationSubscriptionFilters,
  callback: (quotations: Quotation[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "quotations");
  const constraints =
    filters.branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", filters.branchId), where("deletedAt", "==", null)];

  return subscribePagedList<Quotation>(
    colRef,
    constraints,
    "createdAt",
    "desc",
    (quotations, hasMore) => {
      const filtered = filters.status === "all" ? quotations : quotations.filter((qt) => qt.status === filters.status);
      callback(filtered, hasMore);
    },
    onError
  );
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — quotations/page.tsx দেখুন।
 *  status ফিল্টার client-side, তাই এখানে unfiltered ব্যাচ ফেরত দেওয়া হয়
 *  (subscribeToQuotations-এর মতোই) — caller নিজে filter করবে। */
export async function loadMoreQuotations(
  tenantId: string,
  branchId: string | "all",
  lastQuotation: Pick<Quotation, "id" | "createdAt">
): Promise<{ items: Quotation[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "quotations");
  const constraints =
    branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return loadMorePagedList<Quotation>(colRef, constraints, "createdAt", "desc", lastQuotation.createdAt, lastQuotation.id);
}

export function subscribeToQuotation(
  tenantId: string,
  quotationId: string,
  callback: (quotation: Quotation | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "tenants", tenantId, "quotations", quotationId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Quotation) : null),
    onError
  );
}

export function subscribeToQuotationItems(
  tenantId: string,
  quotationId: string,
  callback: (items: QuotationItem[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "quotations", quotationId, "quotation_items");
  const q = query(colRef, orderBy("sortOrder", "asc"));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as QuotationItem)),
    onError
  );
}

export async function getQuotationOnce(tenantId: string, quotationId: string): Promise<Quotation | null> {
  const snap = await getDoc(doc(db, "tenants", tenantId, "quotations", quotationId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Quotation) : null;
}

export async function getQuotationItemsOnce(tenantId: string, quotationId: string): Promise<QuotationItem[]> {
  const colRef = collection(db, "tenants", tenantId, "quotations", quotationId, "quotation_items");
  const snap = await getDocs(query(colRef, orderBy("sortOrder", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QuotationItem);
}

// ─── Create quotation (transactional, mirrors createOrder in T-02) ────────

export interface CreateQuotationResult {
  quotationId: string;
  quotationNumber: string;
}

/**
 * নতুন কোটেশন তৈরি করে, তার quotation_items সাবকালেকশন সহ, সব একসাথে
 * atomically। quotationNumber অস্থায়ীভাবে "OFFLINE-{timestamp}" লেখা হয়;
 * generateQuotationNumber Cloud Function (Firestore onCreate trigger) সার্ভারে
 * পৌঁছানোর পর এটি ক্রমিক "QT-2026-XXXX" নম্বর দিয়ে প্রতিস্থাপন করে, ঠিক
 * generateOrderNumber-এর মতো (blueprint ৫.৪ / ১৩.৫)।
 */
export async function createQuotation(
  tenantId: string,
  userId: string,
  userName: string,
  input: NewQuotationFormInput
): Promise<CreateQuotationResult> {
  const lineTotals = input.items.map((it) => calcEffectiveLineTotal(it.quantity, it.unitPrice, it.totalOverride));
  const subtotal = calcSubtotal(lineTotals);
  const totalAmount = subtotal;
  const itemSummary = buildItemSummary(input.items.map((it) => it.itemName));
  const tempQuotationNumber = buildOfflineQuotationNumber();

  const quotationRef = doc(collection(db, "tenants", tenantId, "quotations"));

  let customerName = input.recipientName.trim();
  let customerPhone = input.recipientPhone.trim();

  if (input.customerId) {
    const customerSnap = await getDoc(doc(db, "tenants", tenantId, "customers", input.customerId));
    if (customerSnap.exists()) {
      const cData = customerSnap.data();
      customerName = (cData.name as string) ?? customerName;
      customerPhone = (cData.phone as string) ?? customerPhone;
    }
  }

  await runTransaction(db, async (tx) => {
    tx.set(quotationRef, {
      id: quotationRef.id,
      tenantId,
      branchId: input.branchId,
      quotationNumber: tempQuotationNumber,
      customerId: input.customerId,
      recipientName: customerName,
      recipientPhone: customerPhone,
      recipientCompany: input.recipientCompany.trim(),
      itemSummary,
      subtotal,
      totalAmount,
      validUntil: Timestamp.fromDate(new Date(input.validUntil)),
      terms: input.terms.trim(),
      notes: input.notes.trim(),
      status: "draft" as QuotationStatus,
      convertedToOrderId: null,
      createdBy: userId,
      createdByName: userName,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    input.items.forEach((item, index) => {
      const itemRef = doc(collection(db, "tenants", tenantId, "quotations", quotationRef.id, "quotation_items"));
      tx.set(itemRef, {
        id: itemRef.id,
        quotationId: quotationRef.id,
        itemName: item.itemName.trim(),
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: round2(lineTotals[index] ?? 0),
        sortOrder: index,
        selectedAttributes: item.selectedAttributes ?? [],
      });
    });
  });

  return { quotationId: quotationRef.id, quotationNumber: tempQuotationNumber };
}

// ─── Status changes ─────────────────────────────────────────────────────

export async function updateQuotationStatus(
  tenantId: string,
  quotationId: string,
  status: QuotationStatus
): Promise<void> {
  await updateDoc(doc(db, "tenants", tenantId, "quotations", quotationId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** Accepted কোটেশন থেকে অর্ডার তৈরির পর — লিংক রেকর্ড করে রাখে, ভবিষ্যতে ডুপ্লিকেট রূপান্তর ঠেকাতে ও তালিকায় দেখানোর জন্য। */
export async function markQuotationConverted(
  tenantId: string,
  quotationId: string,
  orderId: string
): Promise<void> {
  await updateDoc(doc(db, "tenants", tenantId, "quotations", quotationId), {
    convertedToOrderId: orderId,
    updatedAt: serverTimestamp(),
  });
}

export async function softDeleteQuotation(tenantId: string, quotationId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, "tenants", tenantId, "quotations", quotationId), {
    deletedAt: serverTimestamp(),
    deletedBy: userId,
    updatedAt: serverTimestamp(),
  });
}
