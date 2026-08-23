import { round2 } from "@/lib/utils/calculations";

/** মোট কস্টিং = কাঁচামালের খরচ + শ্রম খরচ + অন্যান্য খরচ */
export function calcTotalCosting(rawMaterialCost: number, laborCost: number, otherCost: number): number {
  return round2(rawMaterialCost + laborCost + otherCost);
}

/** গ্রস মুনাফা = মোট বিল − মোট কস্টিং (ব্লুপ্রিন্ট T-11) */
export function calcGrossProfit(totalAmount: number, totalCosting: number): number {
  return round2(totalAmount - totalCosting);
}
