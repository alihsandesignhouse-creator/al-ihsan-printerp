import { round2 } from "@/lib/utils/calculations";
import type { ZakatAssetLine, ZakatPayment, ZakatCategory } from "@/lib/types/zakat";
import { ZAKAT_RATE_PERCENT, ZAKAT_CATEGORIES } from "@/lib/types/zakat";

/** নিট যাকাতযোগ্য সম্পদ = ব্যবসায়িক + বাইরের − দেনা (blueprint ZK-01 সূত্র)। */
export function computeNetZakatableAssets(
  businessAssets: number,
  externalAssets: ZakatAssetLine[],
  liabilities: ZakatAssetLine[]
): number {
  const externalTotal = externalAssets.reduce((sum, line) => sum + line.amount, 0);
  const liabilityTotal = liabilities.reduce((sum, line) => sum + line.amount, 0);
  return round2(businessAssets + externalTotal - liabilityTotal);
}

/**
 * প্রদেয় যাকাত = নিট সম্পদ × ২.৫% (blueprint সূত্র) — কিন্তু শুধুমাত্র নিট
 * সম্পদ নিসাবের সমান বা তার বেশি হলে। এটি ইসলামি বিধানের একটি মৌলিক
 * শর্ত — নিসাবের নিচে যাকাত ফরজ নয়, তাই নিসাব-তুলনা এই ফাংশনে সরাসরি
 * প্রয়োগ করা হয়েছে (শুধু UI-এর জন্য একটি তথ্য হিসেবে নয়)।
 */
export function computeZakatDue(netZakatableAssets: number, nisabAmount: number): number {
  if (nisabAmount <= 0) return 0;
  if (netZakatableAssets < nisabAmount) return 0;
  return round2(netZakatableAssets * (ZAKAT_RATE_PERCENT / 100));
}

export function isBelowNisab(netZakatableAssets: number, nisabAmount: number): boolean {
  return nisabAmount > 0 && netZakatableAssets < nisabAmount;
}

export interface ZakatCategoryBreakdownItem {
  category: ZakatCategory;
  amount: number;
  percentage: number;
}

/** ZK-02 dashboard: "খাতওয়ারি Pie Chart" — ৮টি খাতের মধ্যে বিতরণ। */
export function computeZakatCategoryBreakdown(payments: ZakatPayment[]): ZakatCategoryBreakdownItem[] {
  const totals = new Map<ZakatCategory, number>();
  for (const payment of payments) {
    totals.set(payment.category, round2((totals.get(payment.category) ?? 0) + payment.amount));
  }
  const grandTotal = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);

  return ZAKAT_CATEGORIES.filter((category) => (totals.get(category) ?? 0) > 0).map((category) => {
    const amount = totals.get(category) ?? 0;
    return { category, amount, percentage: grandTotal > 0 ? Math.round((amount / grandTotal) * 1000) / 10 : 0 };
  });
}

export function sumZakatPayments(payments: ZakatPayment[]): number {
  return round2(payments.reduce((sum, p) => sum + p.amount, 0));
}
