import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_PLAN_CATALOG } from "@/lib/types/subscription-plan";
import type { SubscriptionPlanCatalogEntry, CouponCode } from "@/lib/types/subscription-plan";
import type { PlanId, PlanFeatures } from "@/lib/types/tenant";
import { DEFAULT_PLAN_FEATURES } from "@/lib/types/tenant";

const PLAN_IDS: PlanId[] = ["basic", "standard", "premium"];

/**
 * Normalizes a raw Firestore doc (or the DEFAULT_PLAN_CATALOG fallback) so
 * `features` is always populated, even for plan docs saved before the
 * `features` field existed (৩১ জুলাই ২০২৬ সেশন, audit item #9).
 */
function withFeaturesFallback(
  planId: PlanId,
  data: SubscriptionPlanCatalogEntry | undefined
): SubscriptionPlanCatalogEntry {
  if (!data) {
    return { ...DEFAULT_PLAN_CATALOG[planId], updatedAt: null, updatedByAdminId: "" } as SubscriptionPlanCatalogEntry;
  }
  return { ...data, features: data.features ?? DEFAULT_PLAN_FEATURES[planId] };
}

// ─── Plan catalog ───────────────────────────────────────────────────────

const plansCol = () => collection(db, "subscription_plans");
const planDoc = (planId: PlanId) => doc(db, "subscription_plans", planId);

/**
 * Live subscription — always returns all 3 plans (basic/standard/premium)
 * in a fixed order, falling back to DEFAULT_PLAN_CATALOG for any plan that
 * hasn't been saved to Firestore yet (see that constant's comment).
 */
export function subscribeSubscriptionPlans(
  onData: (plans: SubscriptionPlanCatalogEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    plansCol(),
    (snap) => {
      const byId = new Map(snap.docs.map((d) => [d.id, d.data() as SubscriptionPlanCatalogEntry]));
      const plans = PLAN_IDS.map((id) => withFeaturesFallback(id, byId.get(id)));
      onData(plans);
    },
    onError
  );
}

/** One-time fetch for public-facing pages (e.g. /trial-expired's PackageCard). */
export async function getSubscriptionPlansOnce(): Promise<SubscriptionPlanCatalogEntry[]> {
  const snap = await getDocs(plansCol());
  const byId = new Map(snap.docs.map((d) => [d.id, d.data() as SubscriptionPlanCatalogEntry]));
  return PLAN_IDS.map((id) => withFeaturesFallback(id, byId.get(id)));
}

export async function updateSubscriptionPlan(
  planId: PlanId,
  data: {
    monthlyPrice: number;
    yearlyPrice: number;
    maxStaff: number | null;
    maxBranches: number | null;
    featuresBn: string[];
    featuresEn: string[];
    features: PlanFeatures;
  },
  adminId: string
): Promise<void> {
  await setDoc(
    planDoc(planId),
    {
      id: planId,
      ...data,
      updatedAt: serverTimestamp(),
      updatedByAdminId: adminId,
    },
    { merge: true }
  );
}

// ─── Discount coupons ───────────────────────────────────────────────────

const couponsCol = () => collection(db, "coupon_codes");
const couponDoc = (couponId: string) => doc(db, "coupon_codes", couponId);

export function subscribeCoupons(
  onData: (coupons: CouponCode[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(couponsCol(), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CouponCode)),
    onError
  );
}

/** Case-insensitive uniqueness check — best-effort (not transactional; two
 * admins racing to create the same code simultaneously is an accepted,
 * extremely unlikely edge case for a single-super-admin tool). */
export async function isCouponCodeTaken(code: string): Promise<boolean> {
  const snap = await getDocs(couponsCol());
  const normalized = code.trim().toUpperCase();
  return snap.docs.some((d) => (d.data().code as string) === normalized);
}

export async function createCoupon(
  data: {
    code: string;
    discountType: "amount" | "percent";
    discountValue: number;
    validFrom: Date;
    validUntil: Date;
    maxUses: number | null;
    isActive: boolean;
  },
  adminId: string
): Promise<string> {
  const ref = await addDoc(couponsCol(), {
    code: data.code.trim().toUpperCase(),
    discountType: data.discountType,
    discountValue: data.discountValue,
    validFrom: data.validFrom,
    validUntil: data.validUntil,
    maxUses: data.maxUses,
    usedCount: 0,
    isActive: data.isActive,
    createdAt: serverTimestamp(),
    createdByAdminId: adminId,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

export async function updateCoupon(
  couponId: string,
  data: {
    discountType: "amount" | "percent";
    discountValue: number;
    validFrom: Date;
    validUntil: Date;
    maxUses: number | null;
    isActive: boolean;
  }
): Promise<void> {
  // code is intentionally immutable after creation — editing the code text
  // on a coupon that may already be in a customer's hands would silently
  // invalidate it.
  await updateDoc(couponDoc(couponId), {
    discountType: data.discountType,
    discountValue: data.discountValue,
    validFrom: data.validFrom,
    validUntil: data.validUntil,
    maxUses: data.maxUses,
    isActive: data.isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<void> {
  await updateDoc(couponDoc(couponId), { isActive, updatedAt: serverTimestamp() });
}

export async function getSubscriptionPlanDoc(planId: PlanId): Promise<SubscriptionPlanCatalogEntry> {
  const snap = await getDoc(planDoc(planId));
  return withFeaturesFallback(planId, snap.exists() ? (snap.data() as SubscriptionPlanCatalogEntry) : undefined);
}
