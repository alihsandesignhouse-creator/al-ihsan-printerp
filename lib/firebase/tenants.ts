import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  limit,
  writeBatch,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/client';
import type {
  Tenant,
  PlanId,
  PlanFeatures,
  SubscriptionStatus,
  SubscriptionRecord,
  AuditLog,
} from '@/lib/types/tenant';
import { DEFAULT_PLAN_FEATURES, DEFAULT_NOTIFICATION_TEMPLATES } from '@/lib/types/tenant';
import { getSubscriptionPlanDoc } from '@/lib/firebase/subscription-plans';

// ─── Collection References ────────────────────────────────────────────────

const tenantsCol = () => collection(db, 'tenants');
const tenantDoc = (id: string) => doc(db, 'tenants', id);
const subscriptionHistoryCol = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'subscription_history');
const auditLogsCol = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'audit_logs');

// ─── Helper: Compute Effective Features ──────────────────────────────────

/**
 * Merges a tenant's base plan features with its per-tenant overrides.
 *
 * UPDATE (৩১ জুলাই ২০২৬ সেশন, audit item #9): `storedPlanFeatures` is a new
 * optional 3rd argument. Pass `tenant.planFeatures` (the field already
 * present on every cached tenant document — no extra Firestore read, fully
 * offline-safe) to use the LIVE base features Super Admin set in
 * EditPlanModal at the tenant's creation/last-activation time. Omitting it
 * (or passing undefined, e.g. for a tenant document from before this
 * change) falls back to the hardcoded DEFAULT_PLAN_FEATURES[planId]
 * constant exactly as before, so every existing call site keeps compiling
 * and working unchanged until it's updated to pass the 3rd argument.
 */
export function computeEffectiveFeatures(
  planId: PlanId,
  overrides: Partial<PlanFeatures> = {},
  storedPlanFeatures?: PlanFeatures | null,
): PlanFeatures {
  return { ...(storedPlanFeatures ?? DEFAULT_PLAN_FEATURES[planId]), ...overrides };
}

// ─── Helper: Add days to date ─────────────────────────────────────────────

export function addDuration(
  from: Date,
  duration: '1m' | '3m' | '6m' | '12m',
): Date {
  const d = new Date(from);
  const months = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[duration];
  d.setMonth(d.getMonth() + months);
  return d;
}

// ─── Helper: Generate slug from name ─────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .slice(0, 40);
}

// ─── Read: List All Tenants (realtime) ───────────────────────────────────

export function subscribeTenants(
  onData: (tenants: Tenant[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(tenantsCol(), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const tenants = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tenant));
      onData(tenants);
    },
    onError,
  );
}

// ─── Read: Single Tenant ──────────────────────────────────────────────────

export async function fetchTenant(tenantId: string): Promise<Tenant | null> {
  const snap = await getDoc(tenantDoc(tenantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Tenant;
}

export function subscribeTenant(
  tenantId: string,
  onData: (tenant: Tenant | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    tenantDoc(tenantId),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      onData({ id: snap.id, ...snap.data() } as Tenant);
    },
    onError,
  );
}

// ─── Read: Subscription History ───────────────────────────────────────────

export async function fetchSubscriptionHistory(
  tenantId: string,
): Promise<SubscriptionRecord[]> {
  const q = query(subscriptionHistoryCol(tenantId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubscriptionRecord));
}

// ─── Read: Audit Logs for a Tenant ────────────────────────────────────────

export async function fetchTenantAuditLogs(
  tenantId: string,
  maxEntries = 50,
): Promise<AuditLog[]> {
  const q = query(
    auditLogsCol(tenantId),
    orderBy('createdAt', 'desc'),
    limit(maxEntries),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
}

// ─── Write: Create Tenant (Admin Created) ────────────────────────────────
// Note: Full tenant creation (with Firebase Auth user creation) must go
// through the Cloud Function `onAdminCreateTenant`. This function writes
// the Firestore document only after the Cloud Function returns the UID.

export async function createTenantDocument(params: {
  uid: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  district: string;
  planId: PlanId;
  subscriptionStartedAt: Date;
  subscriptionEndsAt: Date;
  orderIdPrefix: string;
  createdByAdminId: string;
}): Promise<string> {
  const slug = generateSlug(params.name);
  const now = Timestamp.now();
  // UPDATE (৩১ জুলাই ২০২৬, audit #9): read the live subscription_plans/{planId}
  // doc so Super Admin's EditPlanModal toggles take effect on brand-new
  // tenants. This is a one-time admin action (not a per-render read), so
  // the extra Firestore round-trip doesn't affect offline-first behavior
  // anywhere else in the app. Falls back to the hardcoded constant if the
  // catalog read fails for any reason.
  const features = await getSubscriptionPlanDoc(params.planId)
    .then((plan) => plan.features)
    .catch(() => DEFAULT_PLAN_FEATURES[params.planId]);

  const tenantRef = doc(db, 'tenants', params.uid);
  await updateDoc(tenantRef, {
    id: params.uid,
    name: params.name,
    slug,
    ownerName: params.ownerName,
    email: params.email,
    phone: params.phone,
    address: '',
    district: params.district,
    logoUrl: '',
    invoiceFooterMessage: '',
    notificationTemplates: DEFAULT_NOTIFICATION_TEMPLATES,
    planId: params.planId,
    planFeatures: features,
    featureOverrides: {},
    subscriptionStatus: 'active' as SubscriptionStatus,
    subscriptionStartedAt: Timestamp.fromDate(params.subscriptionStartedAt),
    subscriptionEndsAt: Timestamp.fromDate(params.subscriptionEndsAt),
    trialStartedAt: null,
    trialEndsAt: null,
    isTrial: false,
    signupSource: 'admin_created',
    activatedBy: params.createdByAdminId,
    activatedAt: now,
    paymentNotes: '',
    orderIdPrefix: params.orderIdPrefix,
    settings: {
      defaultCommissionRate: 10,
      defaultDeliveryDays: 3,
      currency: 'BDT',
      language: 'bn',
    },
    isActive: true,
    updatedAt: now,
  });

  return params.uid;
}

// ─── Write: Activate Tenant (Trial → Paid) ───────────────────────────────

export async function activateTenant(params: {
  tenantId: string;
  planId: PlanId;
  duration: '1m' | '3m' | '6m' | '12m';
  discountType: 'amount' | 'percent';
  discountValue: number;
  paymentNotes: string;
  activatedByAdminId: string;
  /**
   * বাগ-ফিক্স (১৮ আগস্ট ২০২৬ লাইভ-অডিট): Tenant Details পেজের "Activated By"
   * ফিল্ড আগে শুধু `activatedByAdminId` (raw Firebase Auth UID) দেখাত।
   * এখন সেই সাথে ইমেইলও সেভ করা হয় যাতে UI মানুষ-পড়ার-যোগ্য মান দেখাতে
   * পারে। কল-সাইটে সুপার এডমিনের নিজের `user.email` (auth store থেকে)
   * পাঠাতে হবে।
   */
  activatedByAdminEmail: string;
}): Promise<void> {
  const now = new Date();
  const endsAt = addDuration(now, params.duration);
  // See createTenantDocument()'s comment above — same live-catalog read,
  // same offline-safety reasoning (one-time admin action). Re-used here
  // for both `.features` (audit #9) and pricing (audit #10, "তালিকা মূল্য").
  const plan = await getSubscriptionPlanDoc(params.planId).catch(() => null);
  const features = plan?.features ?? DEFAULT_PLAN_FEATURES[params.planId];

  const monthlyPrice = plan?.monthlyPrice ?? 0;
  const yearlyPrice = plan?.yearlyPrice ?? 0;
  const listPriceAmount =
    params.duration === '12m' ? yearlyPrice : monthlyPrice * Number(params.duration.replace('m', ''));
  const discountAmount =
    params.discountType === 'percent'
      ? Math.round((listPriceAmount * params.discountValue) / 100)
      : Math.min(params.discountValue, listPriceAmount);
  const amountReceived = Math.max(0, listPriceAmount - discountAmount);

  const batch = writeBatch(db);
  const ref = tenantDoc(params.tenantId);

  batch.update(ref, {
    planId: params.planId,
    planFeatures: features,
    featureOverrides: {},
    subscriptionStatus: 'active' as SubscriptionStatus,
    subscriptionStartedAt: Timestamp.fromDate(now),
    subscriptionEndsAt: Timestamp.fromDate(endsAt),
    isTrial: false,
    isActive: true,
    activatedBy: params.activatedByAdminId,
    activatedByEmail: params.activatedByAdminEmail,
    activatedAt: Timestamp.fromDate(now),
    paymentNotes: params.paymentNotes,
    updatedAt: Timestamp.fromDate(now),
  });

  // Write subscription history record
  const histRef = doc(subscriptionHistoryCol(params.tenantId));
  batch.set(histRef, {
    id: histRef.id,
    tenantId: params.tenantId,
    planId: params.planId,
    status: 'active',
    startedAt: Timestamp.fromDate(now),
    endsAt: Timestamp.fromDate(endsAt),
    activatedBy: params.activatedByAdminId,
    paymentNotes: params.paymentNotes,
    listPriceAmount,
    discountType: params.discountType,
    discountValue: params.discountValue,
    amountReceived,
    createdAt: Timestamp.fromDate(now),
  });

  await batch.commit();

  // Direct-Call Pattern (Free Edition): replace `onTenantActivated` Cloud
  // Function trigger. Sets custom claims on the tenant's Auth user so their
  // next login picks up isActive: true, isTrial: false.
  // Best-effort — UI shows success regardless (batch already committed).
  void fireActivateTenantClaims(params.tenantId);
}

/**
 * Calls the server-side API route that sets custom claims on the tenant's
 * Firebase Auth user after activation. Uses the current super_admin's
 * ID token for authentication.
 */
async function fireActivateTenantClaims(tenantId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  let token: string;
  try {
    token = await getIdToken(currentUser);
  } catch {
    return;
  }

  try {
    await fetch('/api/super-admin/activate-tenant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tenantId }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[tenants] fireActivateTenantClaims failed:', err);
    }
  }
}

// ─── Write: Edit Tenant ───────────────────────────────────────────────────

export async function updateTenant(
  tenantId: string,
  data: {
    name: string;
    ownerName: string;
    phone: string;
    district: string;
    address: string;
    planId: PlanId;
    subscriptionEndsAt: Date;
    orderIdPrefix: string;
    featureOverrides: Partial<PlanFeatures>;
    updatedByAdminId: string;
  },
): Promise<void> {
  const basePlanFeatures = await getSubscriptionPlanDoc(data.planId)
    .then((plan) => plan.features)
    .catch(() => DEFAULT_PLAN_FEATURES[data.planId]);

  // ROOT CAUSE FIX (সেশন ৩, ১৮ আগস্ট ২০২৬ — "টেন্যান্ট এডিট করলে সেভ হয়
  // না" রিপোর্ট): EditTenantModal.tsx-এ ALL_FEATURE_KEYS-এর প্রতিটার
  // জন্য একটা <Controller name={`featureOverrides.${key}`}> রেন্ডার হয়,
  // কিন্তু ফর্মের defaultValues (`reset({ featureOverrides:
  // tenant.featureOverrides ?? {} })`) সাধারণত মাত্র কয়েকটা key নিয়ে
  // আসে (এটা একটা override-map, সব key আগে থেকে থাকার কথা না)।
  // react-hook-form যেসব field রেজিস্টার্ড কিন্তু defaultValues-এ path
  // নেই, সেগুলোর জন্যও submit-এর সময় চূড়ান্ত ডেটা অবজেক্টে key তৈরি
  // করে ফেলে — মান হিসেবে literal `undefined` বসিয়ে (zod-এর
  // `.optional()` এটা pass করতে দেয়, কারণ undefined-ই optional field-এর
  // বৈধ মান)। ফলে data.featureOverrides প্রতিবার প্রায় ১৫টা key নিয়ে
  // আসে যাদের মান সরাসরি `undefined` (শুধু ২-১টা toggle করা key-তে
  // true/false থাকে)।
  //
  // Firebase JS SDK-তে `ignoreUndefinedProperties` কনফিগার করা নেই
  // (lib/firebase/client.ts) — তাই নিচের updateDoc() নেস্টেড অবজেক্টে
  // একটাও literal `undefined` value পেলেই সরাসরি throw করে
  // ("Function updateDoc() called with invalid data. Unsupported field
  // value: undefined (found in field featureOverrides.xxx)")। এই
  // এররটাই EditTenantModal-এর catch ব্লকে গিয়ে toast.error() হিসেবে
  // দেখাচ্ছিল — অর্থাৎ প্রতিটা tenant-edit সেভ, featureOverrides ফর্মে
  // অন্তত একটা অ-টগলড checkbox থাকা মাত্রই (প্রায় সবসময়ই) ব্যর্থ
  // হচ্ছিল। রুট কজ কনফার্ম করতে computeEffectiveFeatures() ও
  // firestore.rules-এর tenants update rule (যেটা super_admin-এর জন্য
  // top-level `match /{document=**}: allow read, write: if
  // isSuperAdmin();` ব্ল্যাঙ্কেট রুল দিয়ে আগে থেকেই বাইপাস হয়, তাই
  // rules কোনো ব্লকার ছিল না) — দুটোই যাচাই করে বাদ দেওয়া হলো।
  //
  // ফিক্স: featureOverrides থেকে explicit-undefined key ফিল্টার করে
  // বাদ দেওয়া হচ্ছে, শুধু আসলেই toggle-করা (true/false) key-গুলোই
  // Firestore-এ যাবে — একটা override-map-এর জন্য এটাই আসল semantics-ও
  // (untouched key মানে "প্ল্যানের ডিফল্ট অনুসরণ করো", override নয়)।
  const cleanOverrides = Object.fromEntries(
    Object.entries(data.featureOverrides).filter(([, v]) => v !== undefined),
  ) as Partial<PlanFeatures>;

  const effectiveFeatures = computeEffectiveFeatures(data.planId, cleanOverrides, basePlanFeatures);
  await updateDoc(tenantDoc(tenantId), {
    name: data.name,
    ownerName: data.ownerName,
    phone: data.phone,
    district: data.district,
    address: data.address,
    planId: data.planId,
    planFeatures: effectiveFeatures,
    featureOverrides: cleanOverrides,
    subscriptionEndsAt: Timestamp.fromDate(data.subscriptionEndsAt),
    orderIdPrefix: data.orderIdPrefix,
    updatedAt: Timestamp.now(),
  });
}

// ─── Write: Suspend / Reactivate Tenant ──────────────────────────────────

export async function setTenantSuspended(
  tenantId: string,
  suspended: boolean,
): Promise<void> {
  await updateDoc(tenantDoc(tenantId), {
    subscriptionStatus: suspended ? 'suspended' : 'active',
    isActive: !suspended,
    updatedAt: Timestamp.now(),
  });

  // SECURITY FIX (audit item #1, ৩০ জুলাই ২০২৬): this function used to be
  // a pure Firestore write with no Admin SDK step — no Auth custom claim
  // was ever updated, not even the tenant_admin's, let alone any
  // branch_manager/staff member's. Same Direct-Call Pattern as
  // activateTenant() below: the client write above already happened;
  // this is a best-effort side-call for the privileged claims cascade
  // (see lib/server/tenant-claims-sync.ts and
  // app/api/super-admin/sync-tenant-claims/route.ts).
  void fireSyncTenantClaims(tenantId, !suspended);
}

/**
 * Calls the server-side API route that cascades a tenant's isActive
 * status to every user's Auth custom claim after suspend/reactivate.
 * Uses the current super_admin's ID token for authentication — same
 * shape as fireActivateTenantClaims below.
 */
async function fireSyncTenantClaims(tenantId: string, isActive: boolean): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  let token: string;
  try {
    token = await getIdToken(currentUser);
  } catch {
    return;
  }

  try {
    await fetch('/api/super-admin/sync-tenant-claims', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tenantId, isActive }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[tenants] fireSyncTenantClaims failed:', err);
    }
  }
}

// ─── Write: Permanent Delete Tenant (সেশন ৯, ১৮ আগস্ট ২০২৬) ────────────────

export class DeleteTenantError extends Error {}

/**
 * সুপার এডমিন থেকে টেন্যান্ট স্থায়ীভাবে হার্ড-ডিলিট করে — Firestore-এর সব
 * ডেটা (recursiveDelete) ও সংশ্লিষ্ট সব Firebase Auth ইউজার (tenant_admin +
 * সব স্টাফ)। activateTenant()/setTenantSuspended()-এর মতো "client আগেই
 * Firestore write করে, API route শুধু best-effort claims সাইড-ইফেক্ট" নয় —
 * এখানে ক্লায়েন্টের কোনো ডেটা মোছার অনুমতি নেই (recursiveDelete/Auth user
 * deletion দুটোই Admin SDK-only), তাই পুরো কাজটাই এই একটা route-এ হয় এবং
 * এই ফাংশন ব্যর্থতাকে best-effort হিসেবে গিলে ফেলে না — throw করে, যাতে
 * DeleteTenantModal.tsx ব্যবহারকারীকে আসল ব্যর্থতা দেখাতে পারে।
 *
 * `tenantNameConfirmation` ক্লায়েন্টের type-to-confirm ইনপুট থেকে আসে —
 * সার্ভারও নিজে আবার এটা tenant.name-এর সাথে মিলিয়ে দেখে (defense in
 * depth, শুধু UI-level disable-বাটনে ভরসা না করে)।
 */
export async function deleteTenantPermanently(
  tenantId: string,
  tenantNameConfirmation: string,
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new DeleteTenantError('super_admin সেশন পাওয়া যায়নি — আবার লগইন করুন');
  }

  const token = await getIdToken(currentUser);

  const res = await fetch('/api/super-admin/delete-tenant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenantId, tenantNameConfirmation }),
  });

  if (!res.ok) {
    let message = 'টেন্যান্ট ডিলিট করা যায়নি';
    try {
      const data = await res.json();
      if (typeof data?.message === 'string') message = data.message;
    } catch {
      // ignore — non-JSON error body
    }
    throw new DeleteTenantError(message);
  }
}

// ─── Read: Dashboard KPIs (Super Admin) ──────────────────────────────────

export interface SuperAdminKpis {
  totalActive: number;
  trialRunning: number;
  expiringToday: number;
  expired: number;
  suspended: number;
  newThisMonth: number;
}

export async function fetchSuperAdminKpis(): Promise<SuperAdminKpis> {
  const snap = await getDocs(tenantsCol());
  const tenants = snap.docs.map((d) => d.data() as Tenant);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    totalActive: tenants.filter((t) => t.subscriptionStatus === 'active').length,
    trialRunning: tenants.filter((t) => t.subscriptionStatus === 'trial' && t.isActive).length,
    expiringToday: tenants.filter((t) => {
      if (t.subscriptionStatus !== 'trial' || !t.trialEndsAt) return false;
      const d = t.trialEndsAt.toDate();
      return d >= startOfToday && d < endOfToday;
    }).length,
    expired: tenants.filter((t) => t.subscriptionStatus === 'expired').length,
    suspended: tenants.filter((t) => t.subscriptionStatus === 'suspended').length,
    newThisMonth: tenants.filter((t) => {
      const d = t.createdAt.toDate();
      return d >= startOfMonth;
    }).length,
  };
}

// ─── Helper: Compute days left for trial ─────────────────────────────────

export function computeTrialDaysLeft(tenant: Tenant): number | null {
  if (tenant.subscriptionStatus !== 'trial' || !tenant.trialEndsAt) return null;
  const now = Date.now();
  const endsAt = tenant.trialEndsAt.toDate().getTime();
  return Math.max(0, Math.ceil((endsAt - now) / 86400000));
}
