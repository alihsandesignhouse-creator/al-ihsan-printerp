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
import { db } from "./client";
import { subscribePagedList, loadMorePagedList } from "./pagination-helpers";
import {
  round2,
  calcEffectiveLineTotal,
  calcSubtotal,
  calcDiscountAmount,
  calcTotalAmount,
} from "@/lib/utils/calculations";
import type {
  Supplier,
  SupplierFormData,
  SupplierEditData,
  SupplierTransaction,
  SupplierTransactionFormInput,
  SupplierPurchaseFormInput,
} from "@/lib/types/supplier";

// ─── Suppliers (real-time) ──────────────────────────────────────────────────

/**
 * Real-time supplier list subscription. Always excludes soft-deleted suppliers.
 * Branch filtering for Tenant Admin happens here; Branch Manager scoping is
 * additionally enforced server-side by Firebase Security Rules.
 */
export function subscribeSuppliers(
  tenantId: string,
  branchId: string | "all",
  callback: (suppliers: Supplier[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "suppliers");
  const constraints = branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return subscribePagedList<Supplier>(colRef, constraints, "name", "asc", callback, onError);
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — suppliers/page.tsx দেখুন। */
export async function loadMoreSuppliers(
  tenantId: string,
  branchId: string | "all",
  lastSupplier: Pick<Supplier, "id" | "name">
): Promise<{ items: Supplier[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "suppliers");
  const constraints = branchId === "all" ? [where("deletedAt", "==", null)] : [where("branchId", "==", branchId), where("deletedAt", "==", null)];
  return loadMorePagedList<Supplier>(colRef, constraints, "name", "asc", lastSupplier.name, lastSupplier.id);
}

export function subscribeSupplier(
  tenantId: string,
  supplierId: string,
  callback: (supplier: Supplier | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "tenants", tenantId, "suppliers", supplierId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Supplier) : null),
    onError
  );
}

export async function getSupplierOnce(tenantId: string, supplierId: string): Promise<Supplier | null> {
  const snap = await getDoc(doc(db, "tenants", tenantId, "suppliers", supplierId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Supplier) : null;
}

// ─── Create / edit / soft-delete supplier ──────────────────────────────────

export async function createSupplier(tenantId: string, input: SupplierFormData): Promise<string> {
  const supplierRef = doc(collection(db, "tenants", tenantId, "suppliers"));
  await runTransaction(db, async (tx) => {
    tx.set(supplierRef, {
      id: supplierRef.id,
      tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      contactPerson: input.contactPerson.trim(),
      suppliedItems: input.suppliedItems.trim(),
      address: input.address.trim(),
      currentDue: round2(input.openingDue),
      linkedCustomerId: null,
      linkedCustomerName: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return supplierRef.id;
}

export interface CreateSupplierResult {
  supplierId: string;
  customerId: string | null;
}

/**
 * "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচার, ধাপ ৪ (১৭ আগস্ট ২০২৬) — সাপ্লায়ার
 * তৈরির ফর্মে "ইনি একই সাথে আমার কাস্টমারও" checkbox টিক দিলে এটা কল হয়।
 * একই supplier ও name/phone/address দিয়ে একটা নতুন customer ডকুমেন্ট
 * তৈরি করে ও দুই দিকেই লিংক করে — সব একই Firestore transaction-এ atomic
 * (lib/firebase/customers.ts-এর createCustomerInTransaction() হেল্পার
 * পুনর্ব্যবহার করে, ঠিক createOrder()-এ ইনলাইন নতুন কাস্টমার তৈরির মতোই)।
 *
 * firestore.rules-এ কোনো পরিবর্তন লাগেনি — suppliers ও customers দুটোরই
 * create rule ইতিমধ্যে permissive (কোনো .hasOnly() ফিল্ড-রেস্ট্রিকশন নেই,
 * শুধু tenantId/branchId/role/deletedAt==null চেক করে), তাই একই
 * transaction-এ দুটো নতুন ডকুমেন্ট প্রাথমিক লিংক-ফিল্ড সহ লেখা আগে থেকেই
 * অনুমোদিত।
 */
export async function createSupplierWithOptionalCustomerLink(
  tenantId: string,
  input: SupplierFormData,
  alsoCreateLinkedCustomer: boolean
): Promise<CreateSupplierResult> {
  const supplierRef = doc(collection(db, "tenants", tenantId, "suppliers"));
  const customerRef = alsoCreateLinkedCustomer
    ? doc(collection(db, "tenants", tenantId, "customers"))
    : null;
  const trimmedName = input.name.trim();
  const trimmedPhone = input.phone.trim();
  const trimmedAddress = input.address.trim();

  await runTransaction(db, async (tx) => {
    tx.set(supplierRef, {
      id: supplierRef.id,
      tenantId,
      branchId: input.branchId,
      name: trimmedName,
      phone: trimmedPhone,
      contactPerson: input.contactPerson.trim(),
      suppliedItems: input.suppliedItems.trim(),
      address: trimmedAddress,
      currentDue: round2(input.openingDue),
      linkedCustomerId: customerRef?.id ?? null,
      linkedCustomerName: customerRef ? trimmedName : null,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (customerRef) {
      tx.set(customerRef, {
        id: customerRef.id,
        tenantId,
        name: trimmedName,
        phone: trimmedPhone,
        email: "",
        address: trimmedAddress,
        companyName: "",
        linkedSupplierId: supplierRef.id,
        linkedSupplierName: trimmedName,
        deletedAt: null,
        deletedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  return { supplierId: supplierRef.id, customerId: customerRef?.id ?? null };
}

export async function updateSupplier(
  tenantId: string,
  supplierId: string,
  input: SupplierEditData
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "suppliers", supplierId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("suppliers.notFound");
    tx.update(ref, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      contactPerson: input.contactPerson.trim(),
      suppliedItems: input.suppliedItems.trim(),
      address: input.address.trim(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function softDeleteSupplier(
  tenantId: string,
  supplierId: string,
  userId: string
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "suppliers", supplierId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("suppliers.notFound");
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
}

// ─── Supplier ledger (Purchase / Payment) ──────────────────────────────────

/**
 * Records a supplier ledger entry and atomically updates the parent
 * supplier's currentDue inside a Firestore transaction — the same
 * additive / atomic-write pattern used for order payments and stock
 * transactions (blueprint section 5.4).
 *
 * - "purchase": delta = +amount (increases due)
 * - "payment": delta = -amount (decreases due — may go negative, meaning
 *   the tenant has paid the supplier in advance)
 */
export async function recordSupplierTransaction(
  tenantId: string,
  userId: string,
  userName: string,
  supplierId: string,
  input: SupplierTransactionFormInput
): Promise<void> {
  const supplierRef = doc(db, "tenants", tenantId, "suppliers", supplierId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(supplierRef);
    if (!snap.exists()) throw new Error("suppliers.notFound");
    const supplier = snap.data() as Supplier;
    const previousDue = supplier.currentDue;

    const delta = input.type === "purchase" ? round2(input.amount) : round2(-input.amount);
    const newDue = round2(previousDue + delta);

    tx.update(supplierRef, { currentDue: newDue, updatedAt: serverTimestamp() });

    const txRef = doc(collection(db, "tenants", tenantId, "supplier_transactions"));
    tx.set(txRef, {
      id: txRef.id,
      tenantId,
      branchId: supplier.branchId,
      supplierId,
      supplierName: supplier.name,
      type: input.type,
      amount: round2(input.amount),
      delta,
      previousDue,
      newDue,
      paymentMethod: input.type === "payment" ? input.paymentMethod || "cash" : null,
      referenceNumber: input.referenceNumber.trim(),
      note: input.note.trim(),
      performedBy: userId,
      performedByName: userName,
      sourceOrderCostingId: null,
      sourceOrderNumber: null,
      createdAt: serverTimestamp(),
    });
  });
}

export function subscribeSupplierTransactions(
  tenantId: string,
  supplierId: string,
  callback: (transactions: SupplierTransaction[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "supplier_transactions");
  const q = query(colRef, where("supplierId", "==", supplierId), orderBy("createdAt", "desc"), fsLimit(200));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SupplierTransaction)),
    onError
  );
}

// ─── Costing → Supplier ledger link (১৬ আগস্ট ২০২৬, T-11 ↔ T-16 সংযোগ) ─────

/**
 * একটা অর্ডার কস্টিং এন্ট্রির কাঁচামালের খরচকে সাপ্লায়ারের লেজারে "purchase"
 * টাইপ এন্ট্রি হিসেবে যোগ করে ও currentDue আপডেট করে — recordSupplierTransaction-
 * এর মতোই atomic, কিন্তু একই transaction-এ order_costings ডকুমেন্টে
 * supplierTransactionId লিখে দেয় যাতে দ্বিতীবার লিংক করা না যায় (ডাবল-কাউন্টিং
 * প্রতিরোধ)। শুধু tenant_admin/branch_manager UI থেকে এটা কল করতে পারবেন
 * (firestore.rules-এ supplier_transactions create-এর জন্য এই দুই রোলই
 * অনুমোদিত — কোনো নতুন rule লাগেনি)। supplier_transactions append-only
 * (কোনো update/delete rule নেই) বলে এটা unlink করা যায় না — costing পরে
 * বদলালেও এই ডকুমেন্ট অপরিবর্তিত থাকবে, প্রয়োজনে সাপ্লায়ার পেজ থেকে আলাদা
 * সংশোধনী এন্ট্রি (payment/purchase) দিতে হবে।
 */
export async function linkCostingToSupplierLedger(
  tenantId: string,
  userId: string,
  userName: string,
  costing: { orderId: string; orderNumber: string; supplierId: string; rawMaterialCost: number },
  note: string
): Promise<void> {
  const supplierRef = doc(db, "tenants", tenantId, "suppliers", costing.supplierId);
  const costingRef = doc(db, "tenants", tenantId, "order_costings", costing.orderId);

  await runTransaction(db, async (tx) => {
    const [supplierSnap, costingSnap] = await Promise.all([tx.get(supplierRef), tx.get(costingRef)]);
    if (!supplierSnap.exists()) throw new Error("suppliers.notFound");
    if (!costingSnap.exists()) throw new Error("orderCosting.saveFailed");

    const existingLinkId = (costingSnap.data() as { supplierTransactionId?: string | null }).supplierTransactionId;
    if (existingLinkId) throw new Error("suppliers.alreadyLinked");

    const supplier = supplierSnap.data() as Supplier;
    const previousDue = supplier.currentDue;
    const amount = round2(costing.rawMaterialCost);
    const newDue = round2(previousDue + amount);

    tx.update(supplierRef, { currentDue: newDue, updatedAt: serverTimestamp() });

    const txRef = doc(collection(db, "tenants", tenantId, "supplier_transactions"));
    tx.set(txRef, {
      id: txRef.id,
      tenantId,
      branchId: supplier.branchId,
      supplierId: costing.supplierId,
      supplierName: supplier.name,
      type: "purchase" as const,
      amount,
      delta: amount,
      previousDue,
      newDue,
      paymentMethod: null,
      referenceNumber: "",
      note: note.trim(),
      performedBy: userId,
      performedByName: userName,
      sourceOrderCostingId: costing.orderId,
      sourceOrderNumber: costing.orderNumber,
      createdAt: serverTimestamp(),
    });

    tx.update(costingRef, { supplierTransactionId: txRef.id, updatedAt: serverTimestamp() });
  });
}

// ─── Itemized purchase ("ক্রয় করুন" — দ্বৈত কাস্টমার+সাপ্লায়ার প্রোফাইল) ──

export interface RecordItemizedPurchaseResult {
  purchaseTransactionId: string;
  paymentTransactionId: string | null;
}

/**
 * "ক্রয় করুন" ফর্ম সাবমিট হ্যান্ডলার (১৭ আগস্ট ২০২৬)। lib/firebase/orders.ts-
 * এর createOrder()-এর মতোই একই রাউন্ডিং/টোটাল-হিসাবের সূত্র ব্যবহার করে
 * (subtotal → discount → adjustment → totalAmount), কিন্তু orders কালেকশনে
 * কিছু লেখে না — বদলে দুটো পর্যন্ত supplier_transactions এন্ট্রি লেখে:
 *
 * ১. একটা "purchase" এন্ট্রি — amount/delta = +totalAmount (পুরো ক্রয়ের
 *    মূল্য, আইটেম-লিস্ট + ছাড় + অ্যাডজাস্টমেন্ট সহ)।
 * ২. advanceAmount > 0 হলে, তার সাথে সাথেই একটা "payment" এন্ট্রি —
 *    amount/delta = -advanceAmount, purchase এন্ট্রির সাথে দুই দিকে
 *    linkedPaymentTransactionId/linkedPurchaseTransactionId দিয়ে যুক্ত।
 *
 * দুটোই একই Firestore transaction-এ atomic — previousDue/newDue চেইন করে
 * সাপ্লায়ারের currentDue-তে ঠিক নিট প্রভাব (totalAmount - advanceAmount)
 * প্রতিফলিত হয়, ঠিক যেমন recordSupplierTransaction()/createOrder()-এ হয়।
 *
 * addToItemMaster টিক দেওয়া থাকলে createOrder()-এর মতোই আইটেম মাস্টারে
 * নতুন এন্ট্রি তৈরি হয় (items কালেকশন সব ধরনের আইটেমের জন্য শেয়ার্ড —
 * বিক্রি ও ক্রয় উভয়ের জন্যই প্রযোজ্য)।
 */
export async function recordItemizedSupplierPurchase(
  tenantId: string,
  userId: string,
  userName: string,
  supplierId: string,
  input: SupplierPurchaseFormInput,
  /** t("suppliers.purchaseAdvanceNote") — কলিং কম্পোনেন্ট থেকে আগে থেকেই
   *  অনুবাদ করে পাঠাতে হবে (linkCostingToSupplierLedger()-এর প্যাটার্নের
   *  মতোই), কারণ এই lib/firebase ফাইলে next-intl-এর t() উপলব্ধ নেই এবং
   *  supplier-ledger-history.tsx note ফিল্ড অনুবাদ ছাড়াই raw দেখায়। */
  advanceNoteText: string
): Promise<RecordItemizedPurchaseResult> {
  const lineTotals = input.items.map((it) =>
    calcEffectiveLineTotal(it.quantity, it.unitPrice, it.totalOverride)
  );
  const subtotal = calcSubtotal(lineTotals);
  const discountAmount = calcDiscountAmount(subtotal, input.discountType, input.discountValue);
  const totalAmount = calcTotalAmount(subtotal, discountAmount, input.adjustment);
  const advanceAmount = round2(Math.max(0, input.advanceAmount));

  const supplierRef = doc(db, "tenants", tenantId, "suppliers", supplierId);
  const purchaseRef = doc(collection(db, "tenants", tenantId, "supplier_transactions"));
  const paymentRef =
    advanceAmount > 0 ? doc(collection(db, "tenants", tenantId, "supplier_transactions")) : null;

  await runTransaction(db, async (tx) => {
    const supplierSnap = await tx.get(supplierRef);
    if (!supplierSnap.exists()) throw new Error("suppliers.notFound");
    const supplier = supplierSnap.data() as Supplier;

    const previousDue = supplier.currentDue;
    const newDueAfterPurchase = round2(previousDue + totalAmount);
    const newDueAfterPayment = paymentRef ? round2(newDueAfterPurchase - advanceAmount) : newDueAfterPurchase;

    tx.update(supplierRef, { currentDue: newDueAfterPayment, updatedAt: serverTimestamp() });

    tx.set(purchaseRef, {
      id: purchaseRef.id,
      tenantId,
      branchId: input.branchId || supplier.branchId,
      supplierId,
      supplierName: supplier.name,
      type: "purchase" as const,
      amount: totalAmount,
      delta: totalAmount,
      previousDue,
      newDue: newDueAfterPurchase,
      paymentMethod: null,
      referenceNumber: input.referenceNumber.trim(),
      note: input.note.trim(),
      performedBy: userId,
      performedByName: userName,
      sourceOrderCostingId: null,
      sourceOrderNumber: null,
      items: input.items.map((item, index) => ({
        id: item.rowId,
        itemName: item.itemName.trim(),
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: lineTotals[index],
        selectedAttributes: item.selectedAttributes ?? [],
      })),
      subtotal,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount,
      adjustment: input.adjustment,
      linkedPaymentTransactionId: paymentRef?.id ?? null,
      linkedPurchaseTransactionId: null,
      createdAt: serverTimestamp(),
    });

    if (paymentRef) {
      tx.set(paymentRef, {
        id: paymentRef.id,
        tenantId,
        branchId: input.branchId || supplier.branchId,
        supplierId,
        supplierName: supplier.name,
        type: "payment" as const,
        amount: advanceAmount,
        delta: -advanceAmount,
        previousDue: newDueAfterPurchase,
        newDue: newDueAfterPayment,
        paymentMethod: input.advanceMethod || "cash",
        referenceNumber: input.referenceNumber.trim(),
        note: advanceNoteText,
        performedBy: userId,
        performedByName: userName,
        sourceOrderCostingId: null,
        sourceOrderNumber: null,
        linkedPaymentTransactionId: null,
        linkedPurchaseTransactionId: purchaseRef.id,
        createdAt: serverTimestamp(),
      });
    }

    input.items.forEach((item) => {
      if (!item.addToItemMaster) return;
      const masterRef = doc(collection(db, "tenants", tenantId, "items"));
      tx.set(masterRef, {
        id: masterRef.id,
        tenantId,
        name: item.itemName.trim(),
        defaultUnitPrice: item.unitPrice,
        deletedAt: null,
        deletedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  });

  return { purchaseTransactionId: purchaseRef.id, paymentTransactionId: paymentRef?.id ?? null };
}
