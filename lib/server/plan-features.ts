/**
 * lib/server/plan-features.ts
 *
 * Server-only copy of the plan-features table, default notification
 * templates, and slug generator that used to live exclusively in
 * `functions/src/tenantFunctions.ts` (Cloud Functions). Kept as a plain,
 * dependency-free module (no `firebase/firestore` client SDK import) so
 * every migrated API route (`app/api/auth/signup`,
 * `app/api/super-admin/create-tenant`, `app/api/portal/track`) can import
 * the exact same business rule instead of three duplicate inline copies.
 *
 * This intentionally mirrors `lib/types/tenant.ts`'s `DEFAULT_PLAN_FEATURES`
 * / `DEFAULT_NOTIFICATION_TEMPLATES` value-for-value (that file is the
 * client-side source of truth used by dashboard/report gating), and
 * `functions/src/tenantFunctions.ts`'s table (the pre-migration source of
 * truth). Do not let these three drift apart — if a plan's feature set
 * changes, update all of: this file, `lib/types/tenant.ts`, and (while it
 * still exists for Main Edition parity) `functions/src/tenantFunctions.ts`.
 */

export type PlanId = "basic" | "standard" | "premium";

export interface PlanFeatures {
  costCalculator: boolean;
  costingManagement: boolean;
  commissionSystem: boolean;
  expenseManagement: boolean;
  quotations: boolean;
  stockManagement: boolean;
  supplierManagement: boolean;
  multiBranch: boolean;
  advancedReports: boolean;
  customBranding: boolean;
  smsNotifications: boolean;
  emailNotifications: boolean;
  /** Phase 4 WhatsApp ইন্টিগ্রেশন — Meta Cloud API, Premium-only (SMS/Email-এর একই টায়ার)। */
  whatsappNotifications: boolean;
  dataExport: boolean;
  outsourceTracking: boolean;
  customerPortal: boolean;
  prioritySupport: boolean;
}

export const DEFAULT_PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  basic: {
    costCalculator: false,
    costingManagement: false,
    commissionSystem: false,
    expenseManagement: false,
    quotations: false,
    stockManagement: false,
    supplierManagement: false,
    multiBranch: false,
    advancedReports: false,
    customBranding: false,
    smsNotifications: false,
    emailNotifications: false,
    whatsappNotifications: false,
    dataExport: false,
    outsourceTracking: false,
    customerPortal: false,
    prioritySupport: false,
  },
  standard: {
    costCalculator: true,
    costingManagement: true,
    commissionSystem: true,
    expenseManagement: true,
    quotations: true,
    stockManagement: true,
    supplierManagement: true,
    multiBranch: true,
    advancedReports: true,
    customBranding: true,
    smsNotifications: false,
    emailNotifications: false,
    whatsappNotifications: false,
    dataExport: false,
    outsourceTracking: false,
    customerPortal: false,
    prioritySupport: false,
  },
  premium: {
    costCalculator: true,
    costingManagement: true,
    commissionSystem: true,
    expenseManagement: true,
    quotations: true,
    stockManagement: true,
    supplierManagement: true,
    multiBranch: true,
    advancedReports: true,
    customBranding: true,
    smsNotifications: true,
    emailNotifications: true,
    whatsappNotifications: true,
    dataExport: true,
    outsourceTracking: true,
    customerPortal: true,
    prioritySupport: true,
  },
};

/** Trial tenants get every feature (blueprint 4.1: self-signup trial = full software). */
export const TRIAL_FEATURES: PlanFeatures = { ...DEFAULT_PLAN_FEATURES.premium };

/**
 * Server-side mirror of lib/firebase/tenants.ts's computeEffectiveFeatures —
 * merges a tenant's plan defaults with any Super Admin per-tenant overrides.
 * Used by app/api/notifications/* to verify smsNotifications/emailNotifications
 * are actually enabled before spending money on a real SMS/Email send.
 */
export function computeEffectiveFeatures(
  planId: PlanId,
  overrides: Partial<PlanFeatures> = {}
): PlanFeatures {
  return { ...DEFAULT_PLAN_FEATURES[planId], ...overrides };
}

export interface NotificationTemplates {
  sms: {
    orderConfirmation: string;
    deliveryReminder: string;
    paymentReceived: string;
    dueReminder: string;
  };
  email: {
    orderConfirmation: string;
    deliveryReminder: string;
    paymentReceived: string;
    dueReminder: string;
  };
}

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplates = {
  sms: {
    orderConfirmation:
      "আপনার অর্ডার {{orderNumber}} গ্রহণ করা হয়েছে। মোট বিল: {{totalAmount}} টাকা। ধন্যবাদ — {{pressName}}",
    deliveryReminder:
      "আপনার অর্ডার {{orderNumber}} আজ ডেলিভারির জন্য প্রস্তুত। — {{pressName}}",
    paymentReceived:
      "{{amount}} টাকা পেমেন্ট গ্রহণ করা হয়েছে। বকেয়া: {{dueAmount}} টাকা। — {{pressName}}",
    dueReminder:
      "আপনার অর্ডার {{orderNumber}}-এ {{dueAmount}} টাকা বকেয়া আছে। যোগাযোগ করুন। — {{pressName}}",
  },
  email: {
    orderConfirmation:
      "প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}} গ্রহণ করা হয়েছে। মোট বিল: {{totalAmount}} টাকা।",
    deliveryReminder:
      "প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}} আজ ডেলিভারির জন্য প্রস্তুত।",
    paymentReceived:
      "প্রিয় {{customerName}}, {{amount}} টাকা পেমেন্ট গ্রহণ করা হয়েছে। বকেয়া: {{dueAmount}} টাকা।",
    dueReminder:
      "প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}}-এ {{dueAmount}} টাকা বকেয়া আছে।",
  },
};

/**
 * Max active staff (branch_manager / commission_staff / regular_staff)
 * per plan (blueprint section 4.3 / T-07). Authoritative copy for the
 * Free Edition staff API routes (app/api/staff/*) — previously lived only
 * in `functions/src/userFunctions.ts::PLAN_STAFF_LIMITS`, which this
 * mirrors value-for-value. `lib/types/user.ts::PLAN_STAFF_LIMITS` is a
 * separate, display-only client copy ("৩ / ৩ ব্যবহৃত" badges) — keep all
 * three in sync if a plan's staff limit ever changes.
 */
export const PLAN_STAFF_LIMITS: Record<PlanId, number> = {
  basic: 3,
  standard: 10,
  premium: Infinity,
};

/**
 * AUDIT-REPORT-5 Issue #2 fix (৪ আগস্ট ২০২৬): mirrors PLAN_STAFF_LIMITS
 * above — blueprint অংশ ৪.৩ ("সর্বোচ্চ শাখা": basic ১টি / standard ৩টি /
 * premium সীমাহীন) and lib/types/subscription-plan.ts's
 * DEFAULT_PLAN_CATALOG maxBranches values (1 / 3 / null), but as a plain
 * number map usable directly in a `>=` comparison the same way
 * PLAN_STAFF_LIMITS already is in app/api/staff/create/route.ts. Until
 * this session, no code anywhere enforced this limit — see
 * lib/server/branch-helpers.ts and app/api/branches/create/route.ts.
 */
export const PLAN_BRANCH_LIMITS: Record<PlanId, number> = {
  basic: 1,
  standard: 3,
  premium: Infinity,
};

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .slice(0, 40);
}

/**
 * Normalizes a Bangladeshi phone number for comparison by stripping
 * everything but digits and keeping only the last 10 (so "01712345678",
 * "+8801712345678", and "880 1712 345678" all compare equal). Used by the
 * portal tracking route so it never has to store/compare raw formatting.
 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-10);
}
