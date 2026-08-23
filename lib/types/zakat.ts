import type { Timestamp } from "firebase/firestore";

// ─── যাকাত মডিউল — blueprint অংশ ১০ ────────────────────────────────────────
// শুধু Tenant Admin-এর ব্যক্তিগত ব্যবহারের জন্য, ব্যবসায়িক রিপোর্ট থেকে
// সম্পূর্ণ আলাদা। Firestore paths (blueprint ১২.১):
//   /tenants/{tenantId}/zakat_years/{yearId}
//   /tenants/{tenantId}/zakat_payments/{paymentId}

/** নাম + টাকার অঙ্ক + বিবরণ — বাইরের সম্পদ ও বাদযোগ্য দেনা উভয়ের জন্য একই আকৃতি (ZK-01)। */
export interface ZakatAssetLine {
  id: string;
  name: string;
  amount: number;
  description: string;
}

export type ZakatYearStatus = "active" | "completed";

/** /tenants/{tenantId}/zakat_years/{yearId} — blueprint ১২.২-এর স্কিমা অনুসরণ করে। */
export interface ZakatYear {
  id: string;
  tenantId: string;
  hijriYear: string;
  hawlStart: Timestamp;
  hawlEnd: Timestamp;
  /** ব্যবসায়িক সম্পদ — একটি একক সংখ্যা (blueprint স্কিমা), সফটওয়্যার থেকে
   *  নগদ+বকেয়া অনুমান করে প্রি-ফিল করা যায় কিন্তু সম্পূর্ণ সম্পাদনাযোগ্য। */
  businessAssets: number;
  externalAssets: ZakatAssetLine[];
  liabilities: ZakatAssetLine[];
  nisabAmount: number;
  netZakatableAssets: number;
  zakatDue: number;
  /** zakat_payments-এর যোগফল — প্রতিটি পেমেন্ট যোগ হওয়ার সময় একই transaction-এ আপডেট হয় (T-05 recordPayment-এর dueAmount প্যাটার্নের মতো)। */
  zakatPaid: number;
  status: ZakatYearStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const ZAKAT_RATE_PERCENT = 2.5;

/** কুরআনের ৮টি খাত (ZK-02) — blueprint অংশ ১০। */
export const ZAKAT_CATEGORIES = [
  "fakir",
  "miskin",
  "aamileen",
  "muallafatulQulub",
  "riqab",
  "gharimin",
  "fiSabilillah",
  "ibnusSabil",
] as const;
export type ZakatCategory = (typeof ZAKAT_CATEGORIES)[number];

/** /tenants/{tenantId}/zakat_payments/{paymentId} */
export interface ZakatPayment {
  id: string;
  tenantId: string;
  zakatYearId: string;
  hijriYear: string;
  date: Timestamp;
  amount: number;
  method: string;
  category: ZakatCategory;
  recipientName: string;
  notes: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface ZakatAssetsFormData {
  businessAssets: number;
  nisabAmount: number;
  externalAssets: ZakatAssetLine[];
  liabilities: ZakatAssetLine[];
}

export interface ZakatYearStartFormData {
  hijriYear: string;
  hawlStart: string; // yyyy-mm-dd
  hawlEnd: string; // yyyy-mm-dd
}

export interface ZakatPaymentFormData {
  date: string; // yyyy-mm-dd
  amount: number;
  method: string;
  category: ZakatCategory;
  recipientName: string;
  notes: string;
}

/** সফটওয়্যার থেকে আনা ব্যবসায়িক সম্পদের স্ন্যাপশট (ZK-01: "সফটওয়্যার থেকে সর্বশেষ ডেটা আনুন")। */
export interface BusinessAssetsSnapshot {
  /** সব শাখার নগদ কালেকশন − মোট খরচ (আনুমানিক নগদ অবস্থান) */
  netCashPosition: number;
  /** কাস্টমারের কাছে মোট বকেয়া (সব শাখা) */
  totalReceivables: number;
  /** netCashPosition + totalReceivables — businessAssets ফিল্ডে প্রি-ফিল করার জন্য প্রস্তাবিত মোট। স্টকের মূল্য অন্তর্ভুক্ত নয় (দেখুন lib/firebase/zakat.ts মন্তব্য)। */
  suggestedTotal: number;
}
