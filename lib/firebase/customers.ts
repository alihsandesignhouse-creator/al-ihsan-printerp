import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { subscribePagedList, loadMorePagedList } from "./pagination-helpers";
import { round2 } from "@/lib/utils/calculations";
import type { Customer, CustomerFormData } from "@/lib/types/order";
import type { Order, Payment } from "@/lib/types/dashboard";
import type { CustomerFinancialSummary } from "@/lib/types/customer";

// ─── Search (used inline in the New Order form — Module T-02) ─────────────

/**
 * Searches active customers by name prefix or exact phone match.
 * Works offline against the local cache.
 */
export async function searchCustomers(
  tenantId: string,
  searchTerm: string
): Promise<Customer[]> {
  const term = searchTerm.trim();
  if (term.length < 2) return [];

  const colRef = collection(db, "tenants", tenantId, "customers");
  const isPhoneLike = /^\d+$/.test(term);

  const q = isPhoneLike
    ? query(
        colRef,
        where("deletedAt", "==", null),
        where("phone", ">=", term),
        where("phone", "<=", term + "\uf8ff"),
        limit(10)
      )
    : query(
        colRef,
        where("deletedAt", "==", null),
        where("name", ">=", term),
        where("name", "<=", term + "\uf8ff"),
        orderBy("name"),
        limit(10)
      );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer);
}

// ─── Create ─────────────────────────────────────────────────────────────

/**
 * Creates a new customer document inside an existing Firestore transaction
 * (used when a new customer is entered inline while placing an order).
 * Returns the new customer's document id.
 */
export function createCustomerInTransaction(
  tx: Transaction,
  tenantId: string,
  data: CustomerFormData
): string {
  const customerRef = doc(collection(db, "tenants", tenantId, "customers"));
  tx.set(customerRef, {
    id: customerRef.id,
    tenantId,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    address: data.address.trim(),
    companyName: data.companyName.trim(),
    linkedSupplierId: null,
    linkedSupplierName: null,
    deletedAt: null,
    deletedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return customerRef.id;
}

/** Standalone (non-transactional) customer creation — Module T-04 "নতুন কাস্টমার" form. */
export async function createCustomer(
  tenantId: string,
  data: CustomerFormData
): Promise<string> {
  return runTransaction(db, async (tx) => createCustomerInTransaction(tx, tenantId, data));
}

// ─── Update / Soft delete ───────────────────────────────────────────────

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  data: CustomerFormData
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "tenants", tenantId, "customers", customerId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("customers.notFound");
    tx.update(ref, {
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      address: data.address.trim(),
      companyName: data.companyName.trim(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function softDeleteCustomer(
  tenantId: string,
  customerId: string,
  userId: string
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "tenants", tenantId, "customers", customerId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("customers.notFound");
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
}

// ─── Read: list + single profile (live) ────────────────────────────────

/** Subscribes to every active (non-deleted) customer, ordered by name — list page.
 *  callback-এর দ্বিতীয় আর্গুমেন্ট (hasMore) ঐচ্ছিক — পুরনো ১-প্যারামিটার caller
 *  (link-supplier-dialog ইত্যাদি) অপরিবর্তিত থাকতে পারে, TypeScript structurally valid। */
export function subscribeCustomers(
  tenantId: string,
  callback: (customers: Customer[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "customers");
  return subscribePagedList<Customer>(
    colRef,
    [where("deletedAt", "==", null)],
    "name",
    "asc",
    callback,
    (error) => onError(error as Error)
  );
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — customers/page.tsx দেখুন। */
export async function loadMoreCustomers(
  tenantId: string,
  lastCustomer: Pick<Customer, "id" | "name">
): Promise<{ items: Customer[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "customers");
  return loadMorePagedList<Customer>(
    colRef,
    [where("deletedAt", "==", null)],
    "name",
    "asc",
    lastCustomer.name,
    lastCustomer.id
  );
}

/** Subscribes to a single customer's profile document. */
export function subscribeCustomer(
  tenantId: string,
  customerId: string,
  callback: (customer: Customer | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const ref = doc(db, "tenants", tenantId, "customers", customerId);
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Customer) : null),
    (error) => onError(error as Error)
  );
}

// ─── Read: financial aggregation (live, computed — no denormalized counters) ─

/**
 * Subscribes to every non-deleted order for a tenant, optionally scoped to
 * one branch. No `limit()` — unlike the dashboard's KPI queries, due-amount
 * totals must never silently drop old unpaid orders. Used to compute every
 * customer's totalBilled/totalPaid/totalDue on the customer list page in a
 * single query (avoids one query per customer row), and also (as of the
 * ২০ আগস্ট ২০২৬ কোডবেস-অডিট) by lib/hooks/use-reports-data.ts for the
 * Reports page's all-time customer-analysis section (top customers,
 * সর্বোচ্চ বকেয়া, নিষ্ক্রিয় কাস্টমার তালিকা).
 *
 * ⚠️ জানা সীমাবদ্ধতা (২০ আগস্ট ২০২৬ অডিট): কোনো cap/limit ইচ্ছাকৃতভাবে
 * নেই (উপরের কারণেই), তাই বহু-বছর সক্রিয় থাকা টেন্যান্টের জন্য এই query
 * পুরো অর্ডার-হিস্ট্রি (হাজার হাজার ডকুমেন্ট হতে পারে) প্রতিবার ডাউনলোড
 * করবে — Firestore read-খরচ ও Reports পেজ লোড-টাইমের ওপর প্রভাব ফেলবে।
 * এখানে সরাসরি `fsLimit()` বসানো আরও বিপজ্জনক — বড় টেন্যান্টে
 * silently ভুল "সর্বোচ্চ বকেয়া"/"top customer" দেখাবে (পুরনো অর্ডার
 * cutoff-এর বাইরে পড়ে যাবে)। সঠিক দীর্ঘমেয়াদী সমাধান একটা incrementally
 * মেইনটেইনড `customers/{customerId}` সামারি ফিল্ড (প্রতিটা অর্ডার/পেমেন্ট
 * write-এর সাথে transaction দিয়ে আপডেট, Cloud Function ছাড়াই ক্লায়েন্ট
 * কোডেই সম্ভব) — কিন্তু এটা order-create/edit/payment/cascade-delete সব
 * write-path-এ ছোঁয়া লাগবে বলে একটা আলাদা ডেডিকেটেড সেশনের কাজ, এই
 * ফাংশনের সিগনেচার বদলানো "ছোট ফিক্স" না। বর্তমান স্কেলে (নতুন টেন্যান্ট,
 * কম অর্ডার-সংখ্যা) ব্যবহারিক সমস্যা তৈরি করছে না — টেন্যান্টের অর্ডার-
 * সংখ্যা বাড়ার সাথে সাথে মনিটর করা উচিত।
 *
 * IMPORTANT for callers: `branchId` must be "all" only for tenant_admin.
 * For branch_manager/staff it must be their own claims.branchId — Firestore
 * rejects the entire query (not just out-of-scope docs) if an unscoped
 * query could return a document their branch-scoped security rule denies.
 */
export function subscribeOrdersForFinancials(
  tenantId: string,
  branchId: string | "all",
  callback: (orders: Order[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "orders");
  const constraints = [where("deletedAt", "==", null), orderBy("createdAt", "desc")] as const;
  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    (error) => onError(error as Error)
  );
}

/**
 * Groups an order list by customerId into per-customer financial summaries.
 * totalPaid = totalBilled - totalDue: correct because dueAmount is only
 * ever additively reduced by recordPayment() (blueprint section 5.4), never
 * replaced, so this always reconciles with the actual payment ledger.
 */
export function aggregateCustomerFinancials(
  orders: Order[]
): Map<string, CustomerFinancialSummary> {
  const map = new Map<string, CustomerFinancialSummary>();
  for (const order of orders) {
    const existing = map.get(order.customerId) ?? {
      totalBilled: 0,
      totalPaid: 0,
      totalDue: 0,
      orderCount: 0,
    };
    const totalBilled = round2(existing.totalBilled + order.totalAmount);
    const totalDue = round2(existing.totalDue + order.dueAmount);
    map.set(order.customerId, {
      totalBilled,
      totalDue,
      totalPaid: round2(totalBilled - totalDue),
      orderCount: existing.orderCount + 1,
    });
  }
  return map;
}

// ─── Read: single-customer order history + payment ledger (profile tabs) ──

/** Order history tab — a single customer's non-deleted orders, newest first. */
export function subscribeCustomerOrders(
  tenantId: string,
  customerId: string,
  branchId: string | "all",
  callback: (orders: Order[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "orders");
  const constraints = [
    where("customerId", "==", customerId),
    where("deletedAt", "==", null),
    orderBy("createdAt", "desc"),
  ] as const;
  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    (error) => onError(error as Error)
  );
}

/** Payment ledger tab — a single customer's payment history, newest first. */
export function subscribeCustomerPayments(
  tenantId: string,
  customerId: string,
  branchId: string | "all",
  callback: (payments: Payment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "payments");
  // সেশন ২ (soft-delete cascade): cascade-soft-deleted payment বাদ দিতে
  // deletedAt==null যোগ হলো — composite index (customerId ASC, deletedAt ASC,
  // paymentDate DESC) এবং (customerId ASC, branchId ASC, deletedAt ASC,
  // paymentDate DESC), দেখুন firestore.indexes.json।
  const constraints = [
    where("customerId", "==", customerId),
    where("deletedAt", "==", null),
    orderBy("paymentDate", "desc"),
  ] as const;
  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment)),
    (error) => onError(error as Error)
  );
}
