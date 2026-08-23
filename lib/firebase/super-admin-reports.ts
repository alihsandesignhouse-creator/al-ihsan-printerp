import { collection, collectionGroup, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { getSubscriptionPlansOnce } from "@/lib/firebase/subscription-plans";
import type { Tenant, PlanId, SubscriptionRecord } from "@/lib/types/tenant";
import type { SubscriptionPlanCatalogEntry } from "@/lib/types/subscription-plan";

const MONTH_KEYS = [
  "months.jan",
  "months.feb",
  "months.mar",
  "months.apr",
  "months.may",
  "months.jun",
  "months.jul",
  "months.aug",
  "months.sep",
  "months.oct",
  "months.nov",
  "months.dec",
];

export interface SuperAdminMonthlyPoint {
  monthKey: string;
  monthLabelKey: string;
  count: number;
  revenue: number;
}

export interface TrialConversionStats {
  totalTrialSignups: number;
  converted: number;
  conversionRate: number; // 0–100
}

/**
 * Session 7 (super-admin report drilldown): per-tenant aggregate built from
 * the SAME `subscription_history` collectionGroup read already done in
 * fetchSuperAdminReportsData — no extra Firestore reads. `records` holds the
 * tenant's full activation/renewal history (each with its own month via
 * `startedAt`), used to render the modal opened from a table row click.
 */
export interface TenantRevenueBreakdown {
  tenantId: string;
  tenantName: string;
  ownerName: string;
  currentPlanId: PlanId;
  activationCount: number;
  totalRevenue: number;
  records: SubscriptionRecord[]; // sorted desc by createdAt
}

export interface SuperAdminReportsData {
  revenueByMonth: SuperAdminMonthlyPoint[];
  signupsByMonth: SuperAdminMonthlyPoint[];
  conversion: TrialConversionStats;
  /** Snapshot approximation, not true cohort churn — see fetchSuperAdminReportsData's comment. */
  churnRatePercent: number;
  expiredTenants: Tenant[];
  /** Sorted descending by totalRevenue — highest-paying tenant first. */
  tenantRevenueBreakdown: TenantRevenueBreakdown[];
}

/**
 * Returns the revenue for one activation record.
 *
 * UPDATE (৩১ জুলাই ২০২৬ সেশন, audit item #10): `activateTenant()`
 * (lib/firebase/tenants.ts) now saves a structured `amountReceived` field
 * on every new `subscription_history` record (তালিকা মূল্য − ডিসকাউন্ট)
 * — when present, that's the tenant's ACTUAL recorded payment and is used
 * directly, no estimation involved. Records written before this session
 * only have the free-text `paymentNotes` field, so for those we fall back
 * to the old approximation: the plan's catalog price (Module SA-03,
 * `/subscription_plans`) × the activation's duration in months, using the
 * yearly rate once the duration reaches ~12 months.
 */
function estimateRevenue(record: SubscriptionRecord, plan: SubscriptionPlanCatalogEntry): number {
  if (typeof record.amountReceived === "number") {
    return record.amountReceived;
  }
  const start = record.startedAt.toDate();
  const end = record.endsAt.toDate();
  const durationMonths = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.44 * 86400000)));
  if (durationMonths >= 11) {
    return Math.round(plan.yearlyPrice * (durationMonths / 12));
  }
  return plan.monthlyPrice * durationMonths;
}

function buildEmptyMonthlySeries(monthsBack: number): SuperAdminMonthlyPoint[] {
  const now = new Date();
  const points: SuperAdminMonthlyPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({
      monthKey: `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`,
      monthLabelKey: MONTH_KEYS[target.getMonth()] ?? MONTH_KEYS[0]!,
      count: 0,
      revenue: 0,
    });
  }
  return points;
}

/**
 * Single aggregate fetch for the whole SA-04 Reports page — reads every
 * tenant once and every tenant's `subscription_history` once (via a
 * `collectionGroup` query, no `where`/`orderBy` so no composite index is
 * required — see firestore.indexes.json for the pattern used elsewhere
 * when a filter/order IS needed on a collectionGroup query), then computes
 * every report section from that single pair of reads rather than
 * re-querying per chart.
 *
 * একই ধরনের no-limit tradeoff যেমন lib/firebase/customers.ts-এর
 * `subscribeOrdersForFinancials`-এ ডকুমেন্ট করা আছে (২০ আগস্ট ২০২৬
 * কোডবেস-অডিট) — কিন্তু এখানে ঝুঁকি অনেক কম, কারণ এটা per-tenant অর্ডার-
 * সংখ্যা না, প্ল্যাটফর্মের **মোট টেন্যান্ট-সংখ্যা**-র সাথে স্কেল করে,
 * যেটা অনেক ধীরে বাড়ে (এবং শুধু super_admin এই পেজ manually লোড করেন,
 * প্রতিটা tenant_admin-এর প্রতিটা visit-এ না)। তাই এখনই কোনো একশন দরকার
 * নেই, শুধু নোট করে রাখা হলো।
 */
export async function fetchSuperAdminReportsData(): Promise<SuperAdminReportsData> {
  const [tenantsSnap, historySnap, plans] = await Promise.all([
    getDocs(collection(db, "tenants")),
    getDocs(collectionGroup(db, "subscription_history")),
    getSubscriptionPlansOnce(),
  ]);

  const tenants = tenantsSnap.docs.map((d) => d.data() as Tenant);
  const history = historySnap.docs.map((d) => d.data() as SubscriptionRecord);
  const planById = new Map<PlanId, SubscriptionPlanCatalogEntry>(plans.map((p) => [p.id, p]));

  // ── Revenue by month (last 12) ──────────────────────────────────────
  const revenueByMonth = buildEmptyMonthlySeries(12);
  const revenueIndexByKey = new Map(revenueByMonth.map((p, i) => [p.monthKey, i]));
  for (const record of history) {
    const created = record.createdAt?.toDate?.();
    if (!created) continue;
    const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const idx = revenueIndexByKey.get(monthKey);
    if (idx === undefined) continue; // outside the 12-month window
    const plan = planById.get(record.planId);
    if (!plan) continue;
    revenueByMonth[idx]!.revenue += estimateRevenue(record, plan);
    revenueByMonth[idx]!.count += 1; // count = number of activations that month
  }

  // ── Tenant growth: new signups by month (last 12) ───────────────────
  const signupsByMonth = buildEmptyMonthlySeries(12);
  const signupsIndexByKey = new Map(signupsByMonth.map((p, i) => [p.monthKey, i]));
  for (const tenant of tenants) {
    const created = tenant.createdAt?.toDate?.();
    if (!created) continue;
    const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const idx = signupsIndexByKey.get(monthKey);
    if (idx === undefined) continue;
    signupsByMonth[idx]!.count += 1;
  }

  // ── Trial → Paid conversion ──────────────────────────────────────────
  const tenantIdsWithActivation = new Set(history.map((r) => r.tenantId));
  const selfSignupTenants = tenants.filter((t) => t.signupSource === "self_signup");
  const converted = selfSignupTenants.filter((t) => tenantIdsWithActivation.has(t.id)).length;
  const totalTrialSignups = selfSignupTenants.length;
  const conversion: TrialConversionStats = {
    totalTrialSignups,
    converted,
    conversionRate: totalTrialSignups > 0 ? Math.round((converted / totalTrialSignups) * 1000) / 10 : 0,
  };

  // ── Churn rate (snapshot approximation — see interface doc comment) ─
  const activeCount = tenants.filter((t) => t.subscriptionStatus === "active").length;
  const expiredCount = tenants.filter((t) => t.subscriptionStatus === "expired").length;
  const churnBase = activeCount + expiredCount;
  const churnRatePercent = churnBase > 0 ? Math.round((expiredCount / churnBase) * 1000) / 10 : 0;

  // ── Expired subscriptions list ────────────────────────────────────────
  const expiredTenants = tenants
    .filter((t) => t.subscriptionStatus === "expired")
    .sort((a, b) => {
      const aTime = a.subscriptionEndsAt?.toDate?.().getTime() ?? 0;
      const bTime = b.subscriptionEndsAt?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });

  // ── Tenant-wise revenue breakdown (SA-04 drilldown, session 7) ───────
  const tenantById = new Map<string, Tenant>(tenants.map((t) => [t.id, t]));
  const historyByTenant = new Map<string, SubscriptionRecord[]>();
  for (const record of history) {
    if (!record.tenantId) continue;
    const list = historyByTenant.get(record.tenantId) ?? [];
    list.push(record);
    historyByTenant.set(record.tenantId, list);
  }
  const tenantRevenueBreakdown: TenantRevenueBreakdown[] = [];
  historyByTenant.forEach((records, tenantId) => {
    const tenant = tenantById.get(tenantId);
    if (!tenant) return; // orphaned history (deleted tenant) — skip
    const sortedRecords = [...records].sort(
      (a, b) => (b.createdAt?.toDate?.().getTime() ?? 0) - (a.createdAt?.toDate?.().getTime() ?? 0),
    );
    let totalRevenue = 0;
    for (const record of sortedRecords) {
      const plan = planById.get(record.planId);
      if (!plan) continue;
      totalRevenue += estimateRevenue(record, plan);
    }
    tenantRevenueBreakdown.push({
      tenantId,
      tenantName: tenant.name,
      ownerName: tenant.ownerName,
      currentPlanId: tenant.planId,
      activationCount: sortedRecords.length,
      totalRevenue,
      records: sortedRecords,
    });
  });
  tenantRevenueBreakdown.sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    revenueByMonth,
    signupsByMonth,
    conversion,
    churnRatePercent,
    expiredTenants,
    tenantRevenueBreakdown,
  };
}
