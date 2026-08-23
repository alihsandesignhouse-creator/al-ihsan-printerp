import type { DiscountType } from "@/lib/types/order";

/**
 * Rounds to 2 decimal places per blueprint section 8/T-02.
 *
 * FIN-001 ফিক্স (১৬ আগস্ট ২০২৬, external audit): ব্লুপ্রিন্টে verbatim
 * specify করা ছিল `Math.round(value * 100) / 100`, কিন্তু এটা একটা
 * সুপরিচিত JavaScript floating-point রাউন্ডিং বাগের শিকার —
 * `Math.round(1.005 * 100) / 100 === 1` (আসলে ১.০১ হওয়া উচিত), কারণ
 * `1.005 * 100` বাইনারি ফ্লোটিং-পয়েন্টে ঠিক 100.5 না হয়ে
 * 100.49999999999999 হয়ে যায়। ঠিক .00৫-এ শেষ হওয়া টাকার অঙ্কে (যেমন
 * শতাংশ ডিসকাউন্ট থেকে আসা মান) এই বাগ ভুল দিকে রাউন্ড করে দিতে পারে।
 *
 * ফিক্স: রাউন্ড করার আগে `Number.EPSILON` যোগ করে এই representation
 * error সংশোধন করা হচ্ছে — এটাই এই নির্দিষ্ট বাগের জন্য সবচেয়ে পরিচিত ও
 * ব্যাপকভাবে ব্যবহৃত সমাধান। নেগেটিভ মানের জন্যও (যেমন ঋণাত্মক
 * অ্যাডজাস্টমেন্ট) সঠিকভাবে কাজ করার জন্য sign আলাদা করে হ্যান্ডেল করা
 * হয়েছে — sign ছাড়া শুধু positive মানের জন্যই এই ফিক্স কাজ করত।
 *
 * এই একটা ফাংশনই পুরো কোডবেসে টাকার সব রাউন্ডিং-এর একমাত্র উৎস (নিচের
 * সব ফাংশন এটাই কল করে), তাই এই একটা ফিক্সেই সব জায়গায় প্রভাব পড়বে।
 */
export function round2(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

export function calcLineTotal(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

/**
 * "মোট দাম দিয়ে উল্টো হিসাব" ফিচার (৩০ জুলাই ২০২৬): item-row ফর্মগুলোতে
 * (order/quotation/cost-calculator) ব্যবহারকারী এখন quantity + unitPrice-এর
 * বদলে সরাসরি quantity + total টাইপ করতে পারেন — unitPrice তখন
 * (total ÷ quantity) থেকে স্বয়ংক্রিয়ভাবে বসে (দেখানোর জন্য round2 করা)।
 *
 * এই ফাংশনটাই এই ফিচারের মূল নিয়ম প্রয়োগ করে: `totalOverride` সেট থাকলে
 * সেই *ঠিক* সংখ্যাটাই লাইন-টোটাল হিসেবে ব্যবহৃত হয় — কখনো
 * quantity × (রাউন্ড করা unitPrice) দিয়ে পুনরায় হিসাব করা হয় না, যেটা
 * করলে দশমিকের রাউন্ডিং-এর কারণে ব্যবহারকারীর টাইপ করা টোটাল থেকে সামান্য
 * (৳০.০১–০.০২) সরে যেতে পারত। `totalOverride` না থাকলে (null) আগের মতোই
 * quantity × unitPrice থেকে হিসাব হয়।
 */
export function calcEffectiveLineTotal(
  quantity: number,
  unitPrice: number,
  totalOverride: number | null
): number {
  return totalOverride ?? calcLineTotal(quantity, unitPrice);
}

/**
 * quantity বদলালে, total-override মোডে থাকা row-এর জন্য unitPrice নতুন
 * করে হিসাব করে (total অপরিবর্তিত রেখে) — দেখানোর জন্য round2 করা, কিন্তু
 * calcEffectiveLineTotal() সবসময় আসল totalOverride মান-ই ফেরত দেয়, এই
 * রাউন্ড করা unitPrice দিয়ে আবার গুণ করে না।
 */
export function deriveUnitPriceFromTotal(totalOverride: number, quantity: number): number {
  if (quantity <= 0) return 0;
  return round2(totalOverride / quantity);
}

export function calcSubtotal(lineTotals: number[]): number {
  return round2(lineTotals.reduce((sum, v) => sum + v, 0));
}

export function calcDiscountAmount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (discountType === "percent") {
    return round2((subtotal * discountValue) / 100);
  }
  return round2(discountValue);
}

/** চূড়ান্ত বিল = (আইটেমের যোগফল) − ডিসকাউন্ট ± অ্যাডজাস্টমেন্ট */
export function calcTotalAmount(
  subtotal: number,
  discountAmount: number,
  adjustment: number
): number {
  return round2(subtotal - discountAmount + adjustment);
}

/** বকেয়া = চূড়ান্ত বিল − অগ্রিম − পরবর্তী সব পেমেন্টের যোগফল */
export function calcDueAmount(
  totalAmount: number,
  advanceAmount: number,
  additionalPaymentsSum = 0
): number {
  return round2(totalAmount - advanceAmount - additionalPaymentsSum);
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  dueAmount: number;
}

export function computeOrderTotals(params: {
  lineTotals: number[];
  discountType: DiscountType;
  discountValue: number;
  adjustment: number;
  advanceAmount: number;
}): OrderTotals {
  const subtotal = calcSubtotal(params.lineTotals);
  const discountAmount = calcDiscountAmount(subtotal, params.discountType, params.discountValue);
  const totalAmount = calcTotalAmount(subtotal, discountAmount, params.adjustment);
  const dueAmount = calcDueAmount(totalAmount, params.advanceAmount);
  return { subtotal, discountAmount, totalAmount, dueAmount };
}

export function formatTaka(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}৳${Math.abs(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function buildItemSummary(itemNames: string[]): string {
  if (itemNames.length === 0) return "";
  if (itemNames.length === 1) return itemNames[0]!;
  return `${itemNames[0]} +${itemNames.length - 1}`;
}

/** Generates a temporary offline order number per blueprint section 5.4 / 13.5 */
export function buildOfflineOrderNumber(): string {
  return `OFFLINE-${Date.now()}`;
}

export function isOfflineOrderNumber(orderNumber: string): boolean {
  return orderNumber.startsWith("OFFLINE-");
}

/**
 * Case-insensitive exact-name lookup against the item master, used by
 * order-item-rows.tsx / quotation-item-rows.tsx to auto-fill defaultUnitPrice
 * when a typed item name matches an existing master entry (blueprint T-06:
 * "ডিফল্ট মূল্য সেট — অর্ডারে স্বয়ংক্রিয় পূরণ, পরিবর্তনযোগ্য").
 */
export function findItemMasterMatch<T extends { name: string }>(
  options: T[],
  typedName: string
): T | undefined {
  const term = typedName.trim().toLowerCase();
  if (!term) return undefined;
  return options.find((option) => option.name.trim().toLowerCase() === term);
}
