"use client";

import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * Branch scope that is SAFE to pass into any branch-scoped Firestore query
 * (orders, payments, stock_items, stock_transactions, suppliers,
 * supplier_transactions — everything whose security rule is gated by
 * canAccessBranch(resource.data.branchId)).
 *
 * tenant_admin: whatever they've picked in the global branch filter
 * (useUIStore.selectedBranchId), defaulting to "all".
 *
 * Every other role: ALWAYS their own claims.branchId, regardless of the
 * global filter's state. This matters because useUIStore.selectedBranchId
 * defaults to "all" for every user, and Firestore rejects an ENTIRE list
 * query (not just the out-of-scope documents within it) if it could return
 * even one document a non-admin's security rule would deny — so passing
 * "all" straight through for a branch_manager/staff crashes the query with
 * permission-denied the moment the tenant has more than one branch.
 *
 * Bugfix session note: this exact pattern already existed (independently,
 * correctly) in pending-work/page.tsx (Module T-03). This hook extracts it
 * so Dashboard (T-01), Orders (T-02), Stock (T-15), Suppliers (T-16), and
 * Customers (T-04) all share one implementation instead of each re-deriving
 * it — T-01/T-02/T-15/T-16 previously used the raw, unscoped value.
 */
export function useEffectiveBranchId(): string | "all" {
  const role = useAuthStore((s) => s.user?.claims.role);
  const ownBranchId = useAuthStore((s) => s.user?.claims.branchId ?? "all");
  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  return role === "tenant_admin" ? selectedBranchId : ownBranchId;
}
