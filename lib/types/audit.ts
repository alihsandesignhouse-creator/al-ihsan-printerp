import type { AuditLog } from "@/lib/types/tenant";

/**
 * Every distinct `action` string ever written to
 * `/tenants/{tenantId}/audit_logs` across the whole codebase — both the
 * Cloud-Function-side writes (auth.*, tenant.*, user.*, from Module T-01 /
 * T-07 / SA-02) and the client-side writes this module (Audit Log, blueprint
 * ১১.৬) adds for orders, payments, expenses, staff withdrawals, settings,
 * and branches.
 *
 * Kept as a union (not just `string`) so the viewer's category/label maps
 * are exhaustively checked by the compiler — adding a new action anywhere
 * in the app without updating `AUDIT_ACTION_META` below is now a type error.
 */
export type AuditAction =
  // auth — lib/firebase/audit.ts (logAuthEvent)
  | "auth.login"
  | "auth.logout"
  // tenant lifecycle — functions/src/tenantFunctions.ts
  | "tenant.created"
  | "tenant.self_signup"
  | "tenant.trial_expired"
  | "tenant.activated"
  // tenant suspend/reactivate — app/api/super-admin/sync-tenant-claims/route.ts
  // (বাগ-ফিক্স, ১৮ আগস্ট ২০২৬ লাইভ-অডিট: এই দুটো action Admin SDK থেকে সরাসরি
  // Firestore-এ লেখা হতো কিন্তু এই union type-এ কখনো যোগ হয়নি — TypeScript
  // ধরতে পারেনি কারণ Admin SDK route-এর write raw object literal, এই টাইপের
  // বিপরীতে চেক হয় না। ফলে UI-তে auditActionMessageKey() এই দুটো action-এর
  // জন্য translation না পেয়ে raw key দেখাত: "auditLog.action.tenant_suspended")
  | "tenant.suspended"
  | "tenant.reactivated"
  // staff — functions/src/userFunctions.ts
  | "user.created"
  | "user.updated"
  | "user.activated"
  | "user.deactivated"
  // orders — lib/firebase/orders.ts
  | "order.created"
  | "order.status_changed"
  | "order.staff_reassigned"
  | "order.soft_deleted"
  // payments — lib/firebase/orders.ts
  | "payment.recorded"
  // expenses — lib/firebase/expenses.ts
  | "expense.created"
  | "expense.updated"
  | "expense.soft_deleted"
  | "expense_category.created"
  | "expense_category.deleted"
  // staff withdrawals / commission — lib/firebase/commission.ts
  | "withdrawal.requested"
  | "withdrawal.approved"
  | "withdrawal.rejected"
  // outsource tracking — lib/firebase/outsource.ts (audit #৭, T-17)
  | "outsource.created"
  | "outsource.updated"
  | "outsource.soft_deleted"
  // tenant settings — lib/firebase/tenant-settings.ts
  | "settings.general_updated"
  | "settings.business_updated"
  | "settings.notifications_updated"
  | "settings.logo_updated"
  // branches — lib/firebase/branches.ts
  | "branch.created"
  | "branch.updated"
  | "branch.activated"
  | "branch.deactivated"
  // notification delivery retry queue — netlify/functions/retry-notification-deliveries.mts
  | "notification.delivery_failed";

/** Broad grouping used by the Audit Log page's category filter dropdown. */
export type AuditCategory =
  | "auth"
  | "tenant"
  | "user"
  | "order"
  | "payment"
  | "expense"
  | "withdrawal"
  | "outsource"
  | "settings"
  | "branch"
  | "notification";

export const AUDIT_CATEGORIES: AuditCategory[] = [
  "order",
  "payment",
  "expense",
  "withdrawal",
  "outsource",
  "settings",
  "branch",
  "user",
  "tenant",
  "auth",
  "notification",
];

/** action → broad category, used for the filter dropdown and the row icon. */
export const AUDIT_ACTION_CATEGORY: Record<AuditAction, AuditCategory> = {
  "auth.login": "auth",
  "auth.logout": "auth",
  "tenant.created": "tenant",
  "tenant.self_signup": "tenant",
  "tenant.trial_expired": "tenant",
  "tenant.activated": "tenant",
  "tenant.suspended": "tenant",
  "tenant.reactivated": "tenant",
  "user.created": "user",
  "user.updated": "user",
  "user.activated": "user",
  "user.deactivated": "user",
  "order.created": "order",
  "order.status_changed": "order",
  "order.staff_reassigned": "order",
  "order.soft_deleted": "order",
  "payment.recorded": "payment",
  "expense.created": "expense",
  "expense.updated": "expense",
  "expense.soft_deleted": "expense",
  "expense_category.created": "expense",
  "expense_category.deleted": "expense",
  "withdrawal.requested": "withdrawal",
  "withdrawal.approved": "withdrawal",
  "withdrawal.rejected": "withdrawal",
  "outsource.created": "outsource",
  "outsource.updated": "outsource",
  "outsource.soft_deleted": "outsource",
  "settings.general_updated": "settings",
  "settings.business_updated": "settings",
  "settings.notifications_updated": "settings",
  "settings.logo_updated": "settings",
  "branch.created": "branch",
  "branch.updated": "branch",
  "branch.activated": "branch",
  "branch.deactivated": "branch",
  "notification.delivery_failed": "notification",
};

/**
 * `action` string with dots replaced by underscores, matching the
 * `messages/*.json` → `auditLog.action.*` i18n key naming
 * (next-intl namespaces can't contain literal dots in a raw key lookup).
 */
export function auditActionMessageKey(action: string): string {
  return `auditLog.action.${action.replace(/\./g, "_")}`;
}

/**
 * Best-effort category resolver for the rare case a future action string is
 * written before this file is updated to include it — falls back to
 * grouping by the part before the first dot instead of hard-failing.
 */
export function resolveAuditCategory(action: string): AuditCategory {
  const known = AUDIT_ACTION_CATEGORY[action as AuditAction];
  if (known) return known;
  const prefix = action.split(".")[0] ?? "";
  if ((AUDIT_CATEGORIES as string[]).includes(prefix)) return prefix as AuditCategory;
  return "settings";
}

export type { AuditLog };
