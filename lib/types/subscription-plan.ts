import type { Timestamp } from "firebase/firestore";
import type { PlanId, PlanFeatures } from "./tenant";
import { DEFAULT_PLAN_FEATURES } from "./tenant";

/**
 * /subscription_plans/{planId} — doc id is always one of the fixed PlanId
 * values ('basic' | 'standard' | 'premium'). This is a pricing/limits
 * *catalog* for display purposes (blueprint SA-03: "নতুন প্যাকেজ তৈরি: নাম,
 * মূল্য, স্টাফ সীমা, শাখা সীমা, ফিচার তালিকা" / "বিদ্যমান প্যাকেজ সম্পাদনা
 * ও মূল্য পরিবর্তন").
 *
 * UPDATE (৩১ জুলাই ২০২৬ সেশন, audit item #9): this doc's `features` field
 * now DOES drive actual feature-gating — `createTenantDocument()` and
 * `activateTenant()` (lib/firebase/tenants.ts) read this doc's `features`
 * at the moment of tenant creation/activation instead of the hardcoded
 * `DEFAULT_PLAN_FEATURES` code constant, so Super Admin's toggles in
 * EditPlanModal now have real effect. `DEFAULT_PLAN_FEATURES` remains as
 * the in-memory seed value (`DEFAULT_PLAN_CATALOG` below) for any plan
 * that hasn't been explicitly saved to Firestore yet, and as the
 * `app/api/super-admin/create-tenant` API route's fallback if the
 * Firestore doc is missing/incomplete. `featuresBn`/`featuresEn` remain
 * display-only marketing bullet text (/trial-expired pricing page) and
 * are intentionally separate from `features` — a plan's marketing copy
 * and its actual gated feature set are edited independently in the same
 * modal, since the wording doesn't always map 1:1 to a single feature key
 * (e.g. one bullet can describe multiple keys, or vice versa).
 */
export interface SubscriptionPlanCatalogEntry {
  id: PlanId;
  monthlyPrice: number;
  yearlyPrice: number;
  /** null = সীমাহীন (unlimited) */
  maxStaff: number | null;
  /** null = সীমাহীন (unlimited) */
  maxBranches: number | null;
  featuresBn: string[];
  featuresEn: string[];
  /** Actual feature-gating toggles — see doc comment above. */
  features: PlanFeatures;
  updatedAt: Timestamp | null;
  updatedByAdminId: string;
}

/** Seed values matching the blueprint's launch pricing (অংশ ৪.৩) — used
 * whenever a tenant hasn't saved a plan doc yet (first SA-03 visit, or the
 * public /trial-expired page before any Super Admin edit). Never written
 * to Firestore automatically; only used as in-memory fallback/defaults. */
export const DEFAULT_PLAN_CATALOG: Record<PlanId, Omit<SubscriptionPlanCatalogEntry, "updatedAt" | "updatedByAdminId">> = {
  basic: {
    id: "basic",
    // মূল্য: সেশন ৪ (১৮ আগস্ট ২০২৬) — Owner-নির্ধারিত চূড়ান্ত প্যাকেজ
    // মূল্য বসানো হলো (আগে placeholder ৯৯৯/৯৯৯০ ছিল)।
    monthlyPrice: 300,
    yearlyPrice: 3000,
    maxStaff: 3,
    maxBranches: 1,
    features: DEFAULT_PLAN_FEATURES.basic,
    featuresBn: [
      "অর্ডার ব্যবস্থাপনা",
      "কাস্টমার ব্যবস্থাপনা",
      "পেমেন্ট ট্র্যাকিং",
      "ডেলিভারি চালান প্রিন্ট",
      "চলমান কাজের তালিকা",
      "আইটেম মাস্টার",
      "বেসিক রিপোর্ট",
      "অফলাইন সাপোর্ট",
      "যাকাত মডিউল",
    ],
    featuresEn: [
      "Order management",
      "Customer management",
      "Payment tracking",
      "Delivery invoice printing",
      "Pending works list",
      "Item master",
      "Basic reports",
      "Offline support",
      "Zakat module",
    ],
  },
  standard: {
    id: "standard",
    monthlyPrice: 500,
    yearlyPrice: 5000,
    maxStaff: 10,
    maxBranches: 3,
    features: DEFAULT_PLAN_FEATURES.standard,
    featuresBn: [
      "বেসিক-এর সব ফিচার",
      "কস্ট ক্যালকুলেটর",
      "কস্টিং ব্যবস্থাপনা",
      "কমিশন সিস্টেম",
      "খরচ ব্যবস্থাপনা",
      "কোটেশন/দরপত্র",
      "স্টক ম্যানেজমেন্ট",
      "সাপ্লায়ার ম্যানেজমেন্ট",
      "মাল্টি-ব্রাঞ্চ",
      "উন্নত বিশ্লেষণ রিপোর্ট",
    ],
    featuresEn: [
      "Everything in Basic",
      "Cost calculator",
      "Costing management",
      "Commission system",
      "Expense management",
      "Quotations",
      "Stock management",
      "Supplier management",
      "Multi-branch",
      "Advanced analytics reports",
    ],
  },
  premium: {
    id: "premium",
    monthlyPrice: 700,
    yearlyPrice: 7000,
    maxStaff: null,
    maxBranches: null,
    features: DEFAULT_PLAN_FEATURES.premium,
    featuresBn: [
      "স্ট্যান্ডার্ড-এর সব ফিচার",
      "SMS নোটিফিকেশন",
      "Email নোটিফিকেশন",
      "ডেটা এক্সপোর্ট (CSV/Excel)",
      "আউটসোর্স ট্র্যাকিং",
      "গ্রাহক পোর্টাল",
      "অগ্রাধিকার সাপোর্ট",
    ],
    featuresEn: [
      "Everything in Standard",
      "SMS notifications",
      "Email notifications",
      "Data export (CSV/Excel)",
      "Outsource tracking",
      "Customer portal",
      "Priority support",
    ],
  },
};

// ─── Discount coupon codes (blueprint SA-03: "ডিসকাউন্ট কুপন কোড") ────────

/**
 * /coupon_codes/{couponId} — Super-Admin-only (no public read rule; there
 * is no redemption flow wired into signup/renewal yet in this session, so
 * a coupon created here is a record only — see MODULE_README "এখনো বাকি"
 * for the follow-up to actually apply a coupon during self-signup or
 * subscription activation).
 */
export type CouponDiscountType = "amount" | "percent";

export interface CouponCode {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  validFrom: Timestamp;
  validUntil: Timestamp;
  /** null = সীমাহীন ব্যবহার */
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: Timestamp;
  createdByAdminId: string;
  updatedAt: Timestamp;
}
