import type { Timestamp } from "firebase/firestore";
import type { PaymentMethod } from "@/lib/types/dashboard";
import type { DiscountType, SelectedAttribute, OrderItemFormRow } from "@/lib/types/order";

export type { PaymentMethod };

// ─── Suppliers (T-16 — standalone collection) ──────────────────────────────
// /tenants/{tenantId}/suppliers/{supplierId}

export interface Supplier {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  phone: string;
  contactPerson: string;
  suppliedItems: string;
  address: string;
  /** Can be negative — a negative value means the tenant has paid in advance. */
  currentDue: number;
  /** ১৭ আগস্ট ২০২৬ — দেখুন lib/types/order.ts-এর Customer.linkedSupplierId-এর মন্তব্য (প্রতিসম লিংক)। */
  linkedCustomerId: string | null;
  linkedCustomerName: string | null;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SupplierFormData {
  name: string;
  phone: string;
  contactPerson: string;
  suppliedItems: string;
  address: string;
  branchId: string;
  openingDue: number;
}

/** Fields editable after creation — branchId and opening due are not re-editable (changes go through the ledger). */
export interface SupplierEditData {
  name: string;
  phone: string;
  contactPerson: string;
  suppliedItems: string;
  address: string;
}

// ─── Supplier ledger (purchase / payment, single collection per type field) ─
// /tenants/{tenantId}/supplier_transactions/{txId}

export type SupplierTransactionType = "purchase" | "payment";

/**
 * ১৭ আগস্ট ২০২৬ যোগ হলো — "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচারের "ক্রয়
 * করুন" ফর্মের (দ্বৈত প্রোফাইলের জন্য) itemized ক্রয় এন্ট্রি। lib/types/
 * order.ts-এর OrderItem-এর সাথে shape হুবহু মেলানো হয়েছে (orderId-এর বদলে
 * এখানে কোনো ফিল্ড নেই যেহেতু items সরাসরি transaction ডকুমেন্টে embedded,
 * subcollection নয় — supplier_transactions append-only বলে একটা আলাদা
 * subcollection-এর অতিরিক্ত read/write জটিলতার দরকার নেই)।
 */
export interface SupplierPurchaseItem {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  selectedAttributes?: SelectedAttribute[];
}

export interface SupplierTransaction {
  id: string;
  tenantId: string;
  branchId: string;
  supplierId: string;
  supplierName: string;
  type: SupplierTransactionType;
  amount: number;
  /** Signed change applied to currentDue (+amount for purchase, -amount for payment) */
  delta: number;
  previousDue: number;
  newDue: number;
  paymentMethod: PaymentMethod | null;
  referenceNumber: string;
  note: string;
  performedBy: string;
  performedByName: string;
  /**
   * ১৬ আগস্ট ২০২৬ যোগ হলো — এই এন্ট্রিটা যদি T-11 অর্ডার কস্টিং থেকে
   * "লেজারে যোগ করুন" বাটনে স্বয়ংক্রিয়ভাবে তৈরি হয়ে থাকে, তাহলে সেই
   * অর্ডারের ID/নম্বর (ম্যানুয়াল এন্ট্রিতে null)। উভয় দিকেই ট্রেসেবিলিটি:
   * order_costings.supplierTransactionId → এখানে, এবং এখান থেকে →
   * উৎস অর্ডার।
   */
  sourceOrderCostingId: string | null;
  sourceOrderNumber: string | null;
  /**
   * ১৭ আগস্ট ২০২৬ যোগ হলো — নিচের সব ফিল্ড ঐচ্ছিক ও ব্যাকওয়ার্ড-কম্প্যাটিবল:
   * আগে তৈরি সব transaction (এবং সাপ্লায়ার প্রোফাইল পেজের quick modal দিয়ে
   * তৈরি নতুন সাধারণ purchase/payment এন্ট্রি) এই ফিল্ডগুলো ছাড়াই থাকে।
   * শুধু "ক্রয় করুন" itemized ফর্ম (দ্বৈত কাস্টমার+সাপ্লায়ার প্রোফাইলে)
   * দিয়ে তৈরি purchase এন্ট্রিতে এগুলো পূর্ণ থাকে।
   */
  items?: SupplierPurchaseItem[];
  subtotal?: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  adjustment?: number;
  /**
   * itemized purchase এন্ট্রিতে: যদি সেভের সময় অগ্রিম/পেমেন্ট একসাথে দেওয়া
   * হয়ে থাকে, স্বয়ংক্রিয়ভাবে তৈরি হওয়া সংশ্লিষ্ট payment-টাইপ এন্ট্রির ID
   * (একই atomic transaction-এ তৈরি — দেখুন lib/firebase/suppliers.ts →
   * recordItemizedSupplierPurchase())। অগ্রিম না দিলে null।
   */
  linkedPaymentTransactionId?: string | null;
  /** payment-টাইপ এন্ট্রিতে: এটা যদি উপরের linkedPaymentTransactionId দিয়ে
   *  কোনো purchase এন্ট্রি থেকে স্বয়ংক্রিয়ভাবে তৈরি হয়ে থাকে, সেই purchase
   *  এন্ট্রির ID (উভয় দিকে ট্রেসেবিলিটির জন্য); সাধারণ পেমেন্টে null। */
  linkedPurchaseTransactionId?: string | null;
  createdAt: Timestamp;
}

export interface SupplierTransactionFormInput {
  type: SupplierTransactionType;
  amount: number;
  paymentMethod: PaymentMethod | "";
  referenceNumber: string;
  note: string;
}

// ─── Itemized purchase form ("ক্রয় করুন" — দ্বৈত প্রোফাইলের জন্য) ─────────

/**
 * items-এর জন্য lib/types/order.ts-এর OrderItemFormRow টাইপটাই সরাসরি
 * পুনর্ব্যবহার করা হয়েছে (নতুন ডুপ্লিকেট টাইপ তৈরি করা হয়নি) — কারণ একই
 * শেয়ার্ড components/shared/transaction-item-rows.tsx কম্পোনেন্ট এখন
 * অর্ডার ও সাপ্লায়ার-ক্রয় উভয় ফর্মেই ব্যবহৃত হয়, তাই টাইপও একই হতে হবে।
 */
export interface SupplierPurchaseFormInput {
  branchId: string;
  items: OrderItemFormRow[];
  discountType: DiscountType;
  discountValue: number;
  adjustment: number;
  advanceAmount: number;
  advanceMethod: PaymentMethod | "";
  referenceNumber: string;
  note: string;
}

// ─── List filters ───────────────────────────────────────────────────────

export interface SupplierListFilters {
  branchId: string | "all";
  search: string;
  dueOnly: boolean;
}

export const SUPPLIER_TRANSACTION_TYPES: SupplierTransactionType[] = ["purchase", "payment"];
