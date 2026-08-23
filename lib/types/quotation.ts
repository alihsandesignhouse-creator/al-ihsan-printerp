import type { Timestamp } from "firebase/firestore";
import type { SelectedAttribute } from "./order";

// ─── Quotation / দরপত্র — Module T-14 (স্ট্যান্ডার্ড+) ─────────────────────
// blueprint অংশ ৯: "কোটেশন নম্বর: QT-2026-0001 (স্বয়ংক্রিয়), বৈধতার তারিখ,
// আইটেমওয়ারি তালিকা, [কস্ট ক্যালকুলেটর থেকে আমদানি], শর্তাবলী ও মন্তব্য।
// Accepted কোটেশন থেকে এক ক্লিকে অর্ডার তৈরি।"
//
// /tenants/{tenantId}/quotations/{quotationId}, orders-এর মতোই branchId
// বাধ্যতামূলক (T-04-এ প্রতিষ্ঠিত effectiveBranchId প্যাটার্ন এখানেও প্রযোজ্য)।

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export const QUOTATION_STATUSES: QuotationStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];

/**
 * কোটেশন গ্রাহকের সাথে যুক্ত হতে পারে বিদ্যমান কাস্টমার হিসেবে (customerId
 * সেট), অথবা এখনো সিস্টেমে নেই এমন একজন সম্ভাব্য গ্রাহক/প্রতিষ্ঠানের কাছে
 * (customerId === null, recipientName/Phone/Company দিয়ে) — বাস্তব ব্যবসায়িক
 * প্র্যাকটিসে quotation প্রায়ই গ্রাহক হওয়ার আগেই পাঠানো হয়। অর্ডারে
 * রূপান্তরের সময় (T-14 → T-02) একজন কাস্টমার বাধ্যতামূলক, তাই তখন স্টাফকে
 * বিদ্যমান কাস্টমার বেছে নিতে বা নতুন কাস্টমার তৈরি করতে হবে (order-form-এর
 * স্বাভাবিক CustomerPicker দিয়ে, prefill থাকা সত্ত্বেও)।
 */
export interface Quotation {
  id: string;
  tenantId: string;
  branchId: string;
  quotationNumber: string; // "QT-2026-0001" বা অফলাইনে "OFFLINE-{timestamp}"
  customerId: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientCompany: string;
  itemSummary: string; // "প্রথম আইটেম +৩" — লিস্ট ভিউতে দেখানোর জন্য (orders-এর মতো)
  subtotal: number;
  totalAmount: number; // বর্তমানে subtotal-এর সমান (কোটেশনে ডিসকাউন্ট নেই, blueprint T-14 স্কোপ)
  validUntil: Timestamp;
  terms: string;
  notes: string;
  status: QuotationStatus;
  convertedToOrderId: string | null;
  createdBy: string;
  createdByName: string;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** /tenants/{tenantId}/quotations/{quotationId}/quotation_items/{itemId} — blueprint 12.1-এর order_items প্যাটার্ন অনুসরণ করে */
export interface QuotationItem {
  id: string;
  quotationId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
  /** Item Variants ধাপ ২ (১২ আগস্ট ২০২৬) — অর্ডারের OrderItem.selectedAttributes-এর সাথে সামঞ্জস্যপূর্ণ, একই কারণ (ঐচ্ছিক — পুরনো কোটেশন আইটেমে নেই)। */
  selectedAttributes?: SelectedAttribute[];
}

export interface QuotationItemFormRow {
  rowId: string; // client-only, not persisted
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** ৩০ জুলাই ২০২৬ ফিচার — see lib/utils/calculations.ts's
   *  calcEffectiveLineTotal() and OrderItemFormRow's identical field. */
  totalOverride: number | null;
  /** ফর্ম-লেভেল ফিল্ড (order-এর OrderItemFormRow-এর মতো) — dropdown-এ বাছাই করা সাইজ/কালার। */
  selectedAttributes: SelectedAttribute[];
}

export interface NewQuotationFormInput {
  branchId: string;
  customerId: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientCompany: string;
  items: QuotationItemFormRow[];
  validUntil: string; // yyyy-mm-dd
  terms: string;
  notes: string;
}

export type QuotationStatusFilter = QuotationStatus | "all";

/** Prefill payload handed from the quotation detail page to the New Order form on convert. */
export interface QuotationToOrderPrefill {
  quotationId: string;
  branchId: string;
  customerId: string | null;
  recipientName: string;
  recipientPhone: string;
  items: Array<{ itemName: string; description: string; quantity: number; unitPrice: number }>;
  notes: string;
}
