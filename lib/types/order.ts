import type { Timestamp } from "firebase/firestore";
import type { Order, OrderStatus, PaymentMethod, DiscountType, Payment } from "@/lib/types/dashboard";

// Re-export shared types so order components only need to import from one place.
export type { Order, OrderStatus, PaymentMethod, DiscountType, Payment };

// ─── Customers (lightweight — full T-04 module builds on this) ────────────

/**
 * /tenants/{tenantId}/customers/{customerId}
 *
 * No branchId — customers are tenant-wide, not branch-scoped (they may order
 * from multiple branches). Financial totals (billed/paid/due) are NOT stored
 * on this document; Module T-04 (lib/firebase/customers.ts) computes them
 * live from the orders/payments collections on every read, since orders
 * already carry authoritative totalAmount/dueAmount and there is no writer
 * anywhere that keeps a denormalized counter in sync.
 */
export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  companyName: string;
  /**
   * ১৭ আগস্ট ২০২৬ যোগ হলো — কিছু কাস্টমার একই সাথে সাপ্লায়ারও (তার কাছ
   * থেকেও মাল নেওয়া হয়)। দুইটা আলাদা প্রোফাইল/কালেকশনই থাকে (orders,
   * payments, supplier_transactions — সবকিছুর স্কিমা/rules অপরিবর্তিত),
   * শুধু এই ঐচ্ছিক লিংক দুই প্রোফাইলকে একসাথে যুক্ত করে যাতে একটা প্রোফাইল
   * থেকেই অন্যটায় যাওয়া যায় ও নিট হিসাব একসাথে দেখা যায়। null থাকলে এই
   * কাস্টমার সম্পূর্ণ স্বাভাবিক — কোনো আচরণ বদলায় না।
   * দেখুন lib/firebase/customer-supplier-link.ts।
   */
  linkedSupplierId: string | null;
  linkedSupplierName: string | null;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  companyName: string;
}

// ─── Item Master (lightweight — full T-06 module builds on this) ──────────

/**
 * আইটেম ভ্যারিয়েন্ট — audit item #৪, ধাপ ১ (৩১ জুলাই/১ আগস্ট ২০২৬ সেশন)।
 * কস্ট ক্যালকুলেটরের (T-10) "ডাইনামিক ক্যাটাগরি" দর্শনের মতোই — কোনো
 * নির্দিষ্ট অ্যাট্রিবিউট বাধ্যতামূলক নয়, ব্যবহারকারী নিজে গ্রুপ (যেমন
 * "সাইজ", "কালার", "লেমিনেশন") ও প্রতিটা গ্রুপে অপশন (যেমন "A4", "লাল")
 * তৈরি করবেন, প্রতিটা অপশনে ঐচ্ছিক +/- দাম অ্যাডজাস্টমেন্ট।
 */
export interface AttributeOption {
  id: string;
  label: string;
  /** একক মূল্যে যোগ/বিয়োগ হবে এমন পরিমাণ (ধনাত্মক বা ঋণাত্মক, ০ ডিফল্ট) */
  priceAdjustment: number;
}

export interface AttributeGroup {
  id: string;
  name: string;
  options: AttributeOption[];
}

/** /tenants/{tenantId}/items/{itemId} */
export interface ItemMasterEntry {
  id: string;
  tenantId: string;
  name: string;
  defaultUnitPrice: number;
  /**
   * ঐচ্ছিক — বিদ্যমান সব আইটেম ডকুমেন্টে এই ফিল্ড নেই (ব্যাকওয়ার্ড-
   * কম্প্যাটিবিলিটি ভাঙা যাবে না)। খালি অ্যারে বা undefined উভয়ই
   * "কোনো ভ্যারিয়েন্ট নেই" বোঝায়।
   */
  attributeGroups?: AttributeGroup[];
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Order Items (subcollection per blueprint section 12.1) ───────────────

/** /tenants/{tenantId}/orders/{orderId}/order_items/{itemId} */
/**
 * অর্ডারে বাছাই করা আইটেম-ভ্যারিয়েন্ট অপশন (audit #৪, ধাপ ২)। আইটেম
 * মাস্টারের attributeGroups থেকে ব্যবহারকারী প্রতিটা গ্রুপের একটা অপশন
 * বেছে নিলে সেটা এখানে স্ন্যাপশট আকারে সংরক্ষণ হয় — ঠিক payment/order-এর
 * denormalization নীতির মতোই, যাতে আইটেম মাস্টার পরে বদলে গেলেও পুরনো
 * অর্ডারে ঠিক কোন ভ্যারিয়েন্ট বিক্রি হয়েছিল তা অপরিবর্তিত থাকে।
 */
export interface SelectedAttribute {
  groupId: string;
  groupName: string;
  optionId: string;
  optionLabel: string;
  priceAdjustment: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  addToItemMaster: boolean;
  sortOrder: number;
  /** ঐচ্ছিক — ধাপ ২-এর আগে তৈরি সব অর্ডার আইটেমে এই ফিল্ড নেই। */
  selectedAttributes?: SelectedAttribute[];
}

export interface OrderItemFormRow {
  rowId: string; // client-only id for React keys, not persisted
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /**
   * Non-null when the user typed the line's TOTAL directly instead of the
   * per-piece price (৩০ জুলাই ২০২৬ ফিচার) — see
   * lib/utils/calculations.ts's calcEffectiveLineTotal(). When set, this
   * exact value is the line total; `unitPrice` above is just the derived,
   * round2()-displayed per-piece price and is never multiplied back by
   * quantity to re-derive the total.
   */
  totalOverride: number | null;
  addToItemMaster: boolean;
  /** ঐচ্ছিক — ম্যাচ করা আইটেম মাস্টার এন্ট্রিতে attributeGroups থাকলে এখানে ব্যবহারকারীর বাছাই জমা হয় (audit #৪, ধাপ ২)। */
  selectedAttributes: SelectedAttribute[];
}

// ─── Staff selection ────────────────────────────────────────────────────

/** Minimal projection of /tenants/{tenantId}/users/{userId} used for assignment dropdowns */
export interface StaffOption {
  id: string;
  name: string;
  role: "tenant_admin" | "branch_manager" | "commission_staff" | "regular_staff";
  branchId: string | null;
  isActive: boolean;
}

// ─── New Order form ─────────────────────────────────────────────────────

export interface NewOrderFormInput {
  branchId: string;
  customerId: string | null; // null when creating a new customer inline
  newCustomer: CustomerFormData | null;
  items: OrderItemFormRow[];
  expectedDeliveryDate: string; // yyyy-mm-dd
  isUrgent: boolean;
  assignedStaffId: string;
  discountType: DiscountType;
  discountValue: number;
  adjustment: number;
  adjustmentNote: string;
  advanceAmount: number;
  advanceMethod: PaymentMethod | "";
  notes: string;
  /**
   * "সরাসরি ডেলিভারড হিসেবে সেভ করুন" টগল (১২ আগস্ট ২০২৬) — পুরনো/হাতে-লেখা
   * অর্ডার বা ইতিমধ্যে ডেলিভার হওয়া মাল সফটওয়্যারে তুললে পুরো
   * Pending→In Progress→Ready→Delivered ধাপ ম্যানুয়ালি পার না করেই সরাসরি
   * status='delivered' দিয়ে অর্ডার তৈরি করা যায়। markAsDelivered false/undefined
   * থাকলে আগের মতোই status='pending' বসে, deliveredDate সম্পূর্ণ উপেক্ষিত হয়।
   */
  markAsDelivered?: boolean;
  /** yyyy-mm-dd, শুধু markAsDelivered true হলে ব্যবহৃত হয় — আজ বা অতীত তারিখ (ভবিষ্যৎ না, zod-এ যাচাই করা)। */
  deliveredDate?: string;
}

export interface OrderCalculationResult {
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  dueAmount: number;
}

// ─── List filters ───────────────────────────────────────────────────────

export type OrderStatusFilter = OrderStatus | "all";

export interface OrderListFilters {
  status: OrderStatusFilter;
  branchId: string | "all";
  staffId: string | "all";
  dueOnly: boolean;
  search: string;
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "in_progress",
  "ready",
  "delivered",
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "bkash",
  "nagad",
  "rocket",
  "bank",
  "cheque",
];
