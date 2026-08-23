import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { subscribePagedList, loadMorePagedList } from "./pagination-helpers";
import type { ItemMasterEntry } from "@/lib/types/order";
import type { ItemMasterFormValues } from "@/lib/validations/item";

// ─── Create ─────────────────────────────────────────────────────────────

/** Standalone (non-transactional) item creation — Module T-06 "নতুন আইটেম" form. */
export async function createItem(tenantId: string, data: ItemMasterFormValues): Promise<string> {
  return runTransaction(db, async (tx) => {
    const ref = doc(collection(db, "tenants", tenantId, "items"));
    tx.set(ref, {
      id: ref.id,
      tenantId,
      name: data.name.trim(),
      defaultUnitPrice: data.defaultUnitPrice,
      attributeGroups: data.attributeGroups,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  });
}

// ─── Update / Soft delete ───────────────────────────────────────────────

export async function updateItem(
  tenantId: string,
  itemId: string,
  data: ItemMasterFormValues
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "tenants", tenantId, "items", itemId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("itemMaster.notFound");
    tx.update(ref, {
      name: data.name.trim(),
      defaultUnitPrice: data.defaultUnitPrice,
      attributeGroups: data.attributeGroups,
      updatedAt: serverTimestamp(),
    });
  });
}

// ─── Variant attribute — নতুন সাইজ/কালার অপশন অর্ডার-এন্ট্রির সময় যোগ ──────

/**
 * অর্ডার ফর্মে "সাইজ"/"কালার" dropdown-এ ব্যবহারকারী নতুন অপশন টাইপ করলে এটা
 * কল হয় (১২ আগস্ট ২০২৬, Item Variants ধাপ ১, অপশন B — item master-এ
 * স্থায়ীভাবে সেভ)। একই লেবেল (case-insensitive) আগে থেকে থাকলে ডুপ্লিকেট
 * না বানিয়ে বিদ্যমান অপশনটাই ফেরত দেয়। priceAdjustment ডিফল্ট ০ — ব্যবহারকারী
 * পরে item master থেকে চাইলে দাম-সমন্বয় বসাতে পারবেন।
 *
 * ⚠️ Security rule note: firestore.rules-এ `items` কালেকশন সাধারণত শুধু
 * tenant_admin/branch_manager আপডেট করতে পারেন। commission_staff/regular_staff
 * অর্ডার নেওয়ার সময় নতুন সাইজ টাইপ করলে এই ফাংশনই কল হয় — তাই rules-এ একটা
 * সংকীর্ণ ব্যতিক্রম যোগ করা হয়েছে যা শুধু attributeGroups ফিল্ড আপডেট করার
 * অনুমতি দেয় (নাম/দাম/deletedAt-এ না), যাতে স্টাফ চাইলেও আইটেমের অন্য কিছু
 * বদলাতে না পারেন।
 */
export async function addAttributeOption(
  tenantId: string,
  itemId: string,
  groupId: string,
  groupName: string,
  newLabel: string
): Promise<{ optionId: string; optionLabel: string; priceAdjustment: number }> {
  const trimmed = newLabel.trim();
  const ref = doc(db, "tenants", tenantId, "items", itemId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("items.notFound");
    const groups = ((snap.data().attributeGroups as ItemMasterEntry["attributeGroups"]) ?? []).map(
      (g) => ({ ...g, options: [...g.options] })
    );
    let group = groups.find((g) => g.id === groupId);
    if (!group) {
      group = { id: groupId, name: groupName, options: [] };
      groups.push(group);
    }
    const existing = group.options.find(
      (o) => o.label.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return { optionId: existing.id, optionLabel: existing.label, priceAdjustment: existing.priceAdjustment };

    const optionId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    group.options.push({ id: optionId, label: trimmed, priceAdjustment: 0 });
    tx.update(ref, { attributeGroups: groups, updatedAt: serverTimestamp() });
    return { optionId, optionLabel: trimmed, priceAdjustment: 0 };
  });
}

export async function softDeleteItem(tenantId: string, itemId: string, userId: string): Promise<void> {


  await runTransaction(db, async (tx) => {
    const ref = doc(db, "tenants", tenantId, "items", itemId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("itemMaster.notFound");
    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
  });
}

// ─── Read: list (live) ──────────────────────────────────────────────────

/** Subscribes to every active (non-deleted) item, ordered by name — Module T-06 list page. */
export function subscribeItems(
  tenantId: string,
  callback: (items: ItemMasterEntry[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "items");
  return subscribePagedList<ItemMasterEntry>(
    colRef,
    [where("deletedAt", "==", null)],
    "name",
    "asc",
    callback,
    (error) => onError(error as Error)
  );
}

/** "আরও লোড করুন"-এর জন্য পরের ব্যাচ — items/page.tsx দেখুন। */
export async function loadMoreItems(
  tenantId: string,
  lastItem: Pick<ItemMasterEntry, "id" | "name">
): Promise<{ items: ItemMasterEntry[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "items");
  return loadMorePagedList<ItemMasterEntry>(
    colRef,
    [where("deletedAt", "==", null)],
    "name",
    "asc",
    lastItem.name,
    lastItem.id
  );
}

// ─── Read: one-off options list (order/quotation form autofill) ────────

/**
 * One-time fetch of every active item, for the New Order / New Quotation
 * forms' item-name autofill (blueprint T-06: "ডিফল্ট মূল্য সেট — অর্ডারে
 * স্বয়ংক্রিয় পূরণ, পরিবর্তনযোগ্য"). Mirrors getActiveStaffOptions's
 * one-off-getDocs pattern in lib/firebase/orders.ts — these forms don't
 * need a live subscription since the item master rarely changes mid-form-fill.
 */
export async function getActiveItemMasterOptions(tenantId: string): Promise<ItemMasterEntry[]> {
  const colRef = collection(db, "tenants", tenantId, "items");
  const q = query(colRef, where("deletedAt", "==", null), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ItemMasterEntry);
}
