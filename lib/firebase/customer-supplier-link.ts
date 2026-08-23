import { doc, collection, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./client";
import type { Customer } from "@/lib/types/order";
import type { Supplier } from "@/lib/types/supplier";

/**
 * "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচার (১৭ আগস্ট ২০২৬)।
 *
 * ডিজাইন সিদ্ধান্ত: customers ও suppliers সম্পূর্ণ আলাদা কালেকশন/স্কিমাই
 * থাকে (orders, payments, supplier_transactions — সবকিছু অপরিবর্তিত,
 * তাই স্বাভাবিক কোনো কাস্টমার/সাপ্লায়ারের কোনো আচরণ বদলায় না)। শুধু
 * দুই ডকুমেন্টের মধ্যে একটা ঐচ্ছিক, প্রতিসম (bidirectional) লিংক —
 * customer.linkedSupplierId ↔ supplier.linkedCustomerId — যা সম্পূর্ণ
 * opt-in: tenant_admin/branch_manager স্পষ্টভাবে UI থেকে একজোড়া
 * প্রোফাইল বেছে লিংক না করা পর্যন্ত কিছুই ঘটে না। 1:1 সম্পর্ক জোর করা
 * হয় — একটা কাস্টমার একসাথে একাধিক সাপ্লায়ারের সাথে লিংক করা যাবে না,
 * উল্টোটাও না।
 */

export async function linkCustomerToSupplier(
  tenantId: string,
  customer: { id: string; name: string },
  supplier: { id: string; name: string }
): Promise<void> {
  const customerRef = doc(db, "tenants", tenantId, "customers", customer.id);
  const supplierRef = doc(db, "tenants", tenantId, "suppliers", supplier.id);

  await runTransaction(db, async (tx) => {
    const [customerSnap, supplierSnap] = await Promise.all([tx.get(customerRef), tx.get(supplierRef)]);
    if (!customerSnap.exists()) throw new Error("customers.notFound");
    if (!supplierSnap.exists()) throw new Error("suppliers.notFound");

    const existingCustomer = customerSnap.data() as Customer;
    const existingSupplier = supplierSnap.data() as Supplier;
    if (existingCustomer.linkedSupplierId) throw new Error("customerSupplierLink.customerAlreadyLinked");
    if (existingSupplier.linkedCustomerId) throw new Error("customerSupplierLink.supplierAlreadyLinked");

    // firestore.rules-এ customers আপডেটের hasOnly() restriction অনুযায়ী
    // এই দুটো ফিল্ড ছাড়া আর কিছু touch করা যাবে না — তাই dedicated
    // ছোট tx.update() (profile-edit/soft-delete থেকে আলাদা shape)।
    tx.update(customerRef, {
      linkedSupplierId: supplier.id,
      linkedSupplierName: supplier.name,
      updatedAt: serverTimestamp(),
    });
    tx.update(supplierRef, {
      linkedCustomerId: customer.id,
      linkedCustomerName: customer.name,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * সংযোগ বিচ্ছিন্ন করে — কোনো প্রোফাইল, অর্ডার, পেমেন্ট, বা সাপ্লায়ার
 * লেজার এন্ট্রি মুছে/বদলায় না, শুধু দুই দিকের লিংক ফিল্ড null করে দেয়।
 */
export async function unlinkCustomerSupplier(
  tenantId: string,
  customerId: string,
  supplierId: string
): Promise<void> {
  const customerRef = doc(db, "tenants", tenantId, "customers", customerId);
  const supplierRef = doc(db, "tenants", tenantId, "suppliers", supplierId);

  await runTransaction(db, async (tx) => {
    const [customerSnap, supplierSnap] = await Promise.all([tx.get(customerRef), tx.get(supplierRef)]);
    if (customerSnap.exists()) {
      tx.update(customerRef, { linkedSupplierId: null, linkedSupplierName: null, updatedAt: serverTimestamp() });
    }
    if (supplierSnap.exists()) {
      tx.update(supplierRef, { linkedCustomerId: null, linkedCustomerName: null, updatedAt: serverTimestamp() });
    }
  });
}

/**
 * ধাপ ৫ (১৭ আগস্ট ২০২৬) — সাপ্লায়ার প্রোফাইল পেজের "কাস্টমার বানান" বাটন
 * (আগে থেকে তৈরি সাপ্লায়ারদের জন্য, যাদের সাথে এখনো কোনো কাস্টমার লিংক
 * নেই)। বিদ্যমান কোনো কাস্টমার বেছে লিংক করা নয় (সেটা LinkCustomerDialog/
 * linkCustomerToSupplier() করে) — এটা সাপ্লায়ারের নাম/ফোন/ঠিকানা দিয়ে
 * সম্পূর্ণ নতুন একটা কাস্টমার প্রোফাইল তৈরি করে ও সাথে সাথেই দুই দিকে
 * লিংক করে, সব একই Firestore transaction-এ atomic।
 */
export async function createLinkedCustomerFromSupplier(
  tenantId: string,
  supplier: Pick<Supplier, "id" | "name" | "phone" | "address">
): Promise<string> {
  const supplierRef = doc(db, "tenants", tenantId, "suppliers", supplier.id);
  const customerRef = doc(collection(db, "tenants", tenantId, "customers"));

  await runTransaction(db, async (tx) => {
    const supplierSnap = await tx.get(supplierRef);
    if (!supplierSnap.exists()) throw new Error("suppliers.notFound");
    const existingSupplier = supplierSnap.data() as Supplier;
    if (existingSupplier.linkedCustomerId) throw new Error("customerSupplierLink.supplierAlreadyLinked");

    tx.set(customerRef, {
      id: customerRef.id,
      tenantId,
      name: supplier.name.trim(),
      phone: supplier.phone.trim(),
      email: "",
      address: supplier.address.trim(),
      companyName: "",
      linkedSupplierId: supplier.id,
      linkedSupplierName: supplier.name.trim(),
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(supplierRef, {
      linkedCustomerId: customerRef.id,
      linkedCustomerName: supplier.name.trim(),
      updatedAt: serverTimestamp(),
    });
  });

  return customerRef.id;
}
