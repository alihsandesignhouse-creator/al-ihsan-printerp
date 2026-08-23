import type { Firestore } from "firebase-admin/firestore";
import { PLAN_BRANCH_LIMITS } from "./plan-features";

/**
 * lib/server/branch-helpers.ts
 *
 * AUDIT-REPORT-5.md Issue #2 fix (৪ আগস্ট ২০২৬): blueprint অংশ ৪.৩ প্রতিটা
 * প্যাকেজের জন্য একটা সর্বোচ্চ শাখা সংখ্যা নির্দিষ্ট করে (basic ১টি /
 * standard ৩টি / premium সীমাহীন), এবং `lib/types/subscription-plan.ts`-এ
 * `maxBranches` ফিল্ডও সংজ্ঞায়িত ও Super Admin UI-তে দেখানো হয় — কিন্তু
 * কোনো কোড আসলে এটা enforce করতো না (`lib/firebase/branches.ts`-এর
 * `createBranch()` সরাসরি ক্লায়েন্ট SDK দিয়ে কোনো count-check ছাড়াই লিখতো,
 * এবং `firestore.rules`-এর branches create rule শুধু `isTenantAdmin()`
 * চেক করতো)। এই ফাইল দুটো হেল্পার export করে, ঠিক
 * `lib/server/staff-helpers.ts`-এর `countActiveStaff`/`getPlanLimit`-এর
 * মতোই — `app/api/branches/create/route.ts` এই দুটো ব্যবহার করে।
 *
 * (`requireTenantAdmin`/`StaffApiError` নতুন করে ডুপ্লিকেট করা হয়নি —
 * `staff-helpers.ts`-এর নামগুলো staff-নির্দিষ্ট কিছু চেক করে না, শুধু
 * "caller একজন active tenant_admin কিনা" যাচাই করে, তাই সরাসরি সেখান
 * থেকেই import করা হয়েছে।)
 */

export async function countActiveBranches(db: Firestore, tenantId: string): Promise<number> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("branches")
    .where("isActive", "==", true)
    .get();
  return snapshot.size;
}

export async function getBranchLimit(db: Firestore, tenantId: string): Promise<number> {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenant = tenantSnap.data();
  if (!tenant) return 0;
  // Trial tenants run on the premium feature set (blueprint section 4.1)
  // → effectively unlimited branches during trial, same treatment as
  // getPlanLimit() already gives staff.
  if (tenant.isTrial === true) return PLAN_BRANCH_LIMITS.premium;
  const planId = (tenant.planId as keyof typeof PLAN_BRANCH_LIMITS) ?? "basic";
  return PLAN_BRANCH_LIMITS[planId] ?? PLAN_BRANCH_LIMITS.basic;
}
