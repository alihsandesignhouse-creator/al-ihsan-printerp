import { Timestamp } from 'firebase/firestore';

// ─── Subscription Plans ────────────────────────────────────────────────────

export type PlanId = 'basic' | 'standard' | 'premium';
export type SubscriptionStatus = 'active' | 'suspended' | 'expired' | 'trial';
export type SignupSource = 'self_signup' | 'admin_created';
export type Language = 'bn' | 'en';

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
  /** Phase 4 WhatsApp ইন্টিগ্রেশন — Meta Cloud API, Premium-only। */
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

// Full premium features for trial tenants
export const TRIAL_FEATURES: PlanFeatures = { ...DEFAULT_PLAN_FEATURES.premium };

/**
 * Ordered list of every PlanFeatures key — single source of truth used
 * wherever the UI needs to iterate all 16 feature toggles (EditTenantModal's
 * per-tenant overrides, EditPlanModal's per-plan base toggles as of the
 * ৩১ জুলাই ২০২৬ session). Keep in sync with the PlanFeatures interface above.
 */
export const ALL_FEATURE_KEYS: (keyof PlanFeatures)[] = [
  'costCalculator', 'costingManagement', 'commissionSystem', 'expenseManagement',
  'quotations', 'stockManagement', 'supplierManagement', 'multiBranch',
  'advancedReports', 'customBranding', 'smsNotifications', 'emailNotifications',
  'whatsappNotifications', 'dataExport', 'outsourceTracking', 'customerPortal', 'prioritySupport',
];

// ─── Tenant Document ───────────────────────────────────────────────────────

export interface TenantSettings {
  defaultCommissionRate: number;
  defaultDeliveryDays: number;
  currency: string;
  language: Language;
}

/**
 * SMS/Email template text per event. Storage only in this module — actual
 * sending is Phase 3 (blueprint section 16, module 28/29) and not yet wired
 * to Cloud Functions. `{{placeholder}}` tokens are documented in the UI.
 */
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
    orderConfirmation: 'আপনার অর্ডার {{orderNumber}} গ্রহণ করা হয়েছে। মোট বিল: {{totalAmount}} টাকা। ধন্যবাদ — {{pressName}}',
    deliveryReminder: 'আপনার অর্ডার {{orderNumber}} আজ ডেলিভারির জন্য প্রস্তুত। — {{pressName}}',
    paymentReceived: '{{amount}} টাকা পেমেন্ট গ্রহণ করা হয়েছে। বকেয়া: {{dueAmount}} টাকা। — {{pressName}}',
    dueReminder: 'আপনার অর্ডার {{orderNumber}}-এ {{dueAmount}} টাকা বকেয়া আছে। যোগাযোগ করুন। — {{pressName}}',
  },
  email: {
    orderConfirmation: 'প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}} গ্রহণ করা হয়েছে। মোট বিল: {{totalAmount}} টাকা।',
    deliveryReminder: 'প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}} আজ ডেলিভারির জন্য প্রস্তুত।',
    paymentReceived: 'প্রিয় {{customerName}}, {{amount}} টাকা পেমেন্ট গ্রহণ করা হয়েছে। বকেয়া: {{dueAmount}} টাকা।',
    dueReminder: 'প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}}-এ {{dueAmount}} টাকা বকেয়া আছে।',
  },
};

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  district: string;
  logoUrl: string;
  /**
   * tenant_admin-এর নিজস্ব প্রোফাইল ছবি (সেশন ৫, ১৮ আগস্ট ২০২৬) —
   * lib/firebase/profile.ts-এর uploadProfileAvatar() লেখে। tenant_admin-এর
   * আলাদা /users/{uid} ডকুমেন্ট নেই বলে এখানে রাখা হয়েছে (ownerName-এর
   * মতোই)। পুরনো ডকুমেন্টে এই ফিল্ড নেই বলে optional।
   */
  ownerAvatarUrl?: string;
  invoiceFooterMessage: string;
  notificationTemplates: NotificationTemplates;
  planId: PlanId;
  planFeatures: PlanFeatures;
  // Feature overrides set by Super Admin (merged on top of planFeatures)
  featureOverrides: Partial<PlanFeatures>;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStartedAt: Timestamp | null;
  subscriptionEndsAt: Timestamp | null;
  trialStartedAt: Timestamp | null;
  trialEndsAt: Timestamp | null;
  isTrial: boolean;
  signupSource: SignupSource;
  activatedBy: string | null;
  /**
   * বাগ-ফিক্স (১৮ আগস্ট ২০২৬ লাইভ-অডিট): আগে Tenant Details পেজে
   * `activatedBy`-র raw Firebase Auth UID সরাসরি দেখানো হতো ("Activated By:
   * zIRt5ITwPHXFWZPKQLWvZVLsvll1")। এখন activateTenant() একই সাথে এই ইমেইল
   * ফিল্ডও লেখে যাতে UI মানুষ-পড়ার-যোগ্য মান দেখাতে পারে। এই সেশনের আগে
   * activate হওয়া পুরনো টেন্যান্টে এই ফিল্ড null থাকবে — সেক্ষেত্রে UI
   * raw `activatedBy`-তে fallback করে (নতুন করে activate/re-activate না
   * করা পর্যন্ত)।
   */
  activatedByEmail: string | null;
  activatedAt: Timestamp | null;
  paymentNotes: string;
  orderIdPrefix: string;
  settings: TenantSettings;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Subscription History ──────────────────────────────────────────────────

export interface SubscriptionRecord {
  id: string;
  tenantId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  startedAt: Timestamp;
  endsAt: Timestamp;
  activatedBy: string;
  paymentNotes: string;
  createdAt: Timestamp;
  /**
   * Structured payment fields (৩১ জুলাই ২০২৬ সেশন, audit item #10).
   * Optional because records written before this session only have the
   * free-text `paymentNotes` above — see estimateRevenue() in
   * lib/firebase/super-admin-reports.ts for how the two eras are
   * reconciled in the SA-04 revenue report.
   */
  listPriceAmount?: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  /** তালিকা মূল্য − ডিসকাউন্ট = প্রকৃত প্রাপ্ত টাকা (১০০% ডিসকাউন্ট = ফ্রি activation, ০ টাকা) */
  amountReceived?: number;
}

// ─── Audit Log ────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: Timestamp;
}

// ─── Form Types ───────────────────────────────────────────────────────────

export interface CreateTenantFormData {
  name: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  district: string;
  planId: PlanId;
  subscriptionStartedAt: string; // date string yyyy-mm-dd
  subscriptionEndsAt: string;    // date string yyyy-mm-dd
  orderIdPrefix: string;
}

export interface ActivateTenantFormData {
  planId: PlanId;
  duration: '1m' | '3m' | '6m' | '12m';
  paymentNotes: string;
}

export interface EditTenantFormData {
  name: string;
  ownerName: string;
  phone: string;
  district: string;
  address: string;
  planId: PlanId;
  subscriptionEndsAt: string;
  featureOverrides: Partial<PlanFeatures>;
  orderIdPrefix: string;
}

// ─── Tab Filter ──────────────────────────────────────────────────────────

export type TenantTab =
  | 'all'
  | 'trial'
  | 'expiring_today'
  | 'expired'
  | 'active'
  | 'suspended';

// ─── Computed Helper Types ────────────────────────────────────────────────

export interface TenantWithDaysLeft extends Tenant {
  daysLeft: number | null;
}

// Districts in Bangladesh
export const BANGLADESH_DISTRICTS = [
  'ঢাকা', 'চট্টগ্রাম', 'রাজশাহী', 'খুলনা', 'বরিশাল',
  'সিলেট', 'রংপুর', 'ময়মনসিংহ', 'কুমিল্লা', 'নারায়ণগঞ্জ',
  'গাজীপুর', 'টাঙ্গাইল', 'জামালপুর', 'শেরপুর', 'নেত্রকোণা',
  'কিশোরগঞ্জ', 'ময়মনসিংহ সদর', 'ফরিদপুর', 'মাদারীপুর',
  'গোপালগঞ্জ', 'শরীয়তপুর', 'রাজবাড়ী', 'মানিকগঞ্জ',
  'মুন্সীগঞ্জ', 'নরসিংদী', 'ব্রাহ্মণবাড়িয়া', 'চাঁদপুর',
  'লক্ষ্মীপুর', 'নোয়াখালী', 'ফেনী', 'কক্সবাজার', 'বান্দরবান',
  'রাঙ্গামাটি', 'খাগড়াছড়ি', 'হবিগঞ্জ', 'মৌলভীবাজার',
  'সুনামগঞ্জ', 'নওগাঁ', 'চাঁপাইনবাবগঞ্জ', 'নাটোর',
  'পাবনা', 'সিরাজগঞ্জ', 'বগুড়া', 'জয়পুরহাট', 'গাইবান্ধা',
  'কুড়িগ্রাম', 'লালমনিরহাট', 'নীলফামারী', 'দিনাজপুর',
  'ঠাকুরগাঁও', 'পঞ্চগড়', 'যশোর', 'ঝিনাইদহ', 'মাগুরা',
  'নড়াইল', 'সাতক্ষীরা', 'বাগেরহাট', 'পিরোজপুর', 'ঝালকাঠি',
  'বরগুনা', 'পটুয়াখালী', 'ভোলা', 'কুষ্টিয়া', 'মেহেরপুর',
  'চুয়াডাঙ্গা',
] as const;
