"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useAdminDashboardData, useStaffDashboardData } from "@/lib/hooks/use-dashboard-data";
import { AdminDashboard } from "@/components/tenant/dashboard/admin-dashboard";
import { StaffDashboard } from "@/components/tenant/dashboard/staff-dashboard";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { subscribeOwnStaffMember } from "@/lib/firebase/users";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import type { Tenant } from "@/lib/types/tenant";
import type { StaffMember } from "@/lib/types/user";

export default function DashboardPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);

  const role = user?.claims.role ?? "regular_staff";
  const tenantId = user?.claims.tenantId ?? null;
  const isStaffRole = role === "commission_staff" || role === "regular_staff";

  // Non-admin roles are always scoped to their own branch — passing the raw
  // "all" default straight into a branch-scoped Firestore query fails the
  // ENTIRE query with permission-denied for them. See use-effective-branch-id.ts.
  // Note: `selectedBranchId` (raw UI store value) is still passed to
  // AdminDashboard's branch-filter dropdown below, since that control itself
  // must only ever be shown to (and reflect the free choice of) tenant_admin.
  const effectiveBranchId = useEffectiveBranchId();

  // Module T-12: this was previously a hardcoded `PLAN_FEATURES_PLACEHOLDER`
  // (always false), so the net-profit and commission KPI cards could never
  // unlock regardless of the tenant's actual plan. Now sourced from the
  // tenant document via the same computeEffectiveFeatures() helper T-09/T-10
  // already use.
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [staffDoc, setStaffDoc] = useState<StaffMember | null>(null);
  const handleFirestoreError = useFirestoreErrorHandler();

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(tenantId, setTenant, handleFirestoreError());
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !user?.uid || !isStaffRole) return;
    const unsub = subscribeOwnStaffMember(tenantId, user.uid, setStaffDoc, handleFirestoreError());
    return unsub;
  }, [tenantId, user?.uid, isStaffRole, handleFirestoreError]);

  const features = tenant ? computeEffectiveFeatures(tenant.planId, tenant.featureOverrides, tenant.planFeatures) : null;
  const hasNetProfitFeature = features?.advancedReports ?? false;
  const hasCommissionFeature = features?.commissionSystem ?? false;

  const adminData = useAdminDashboardData(
    !isStaffRole ? tenantId : null,
    effectiveBranchId,
    hasNetProfitFeature
  );

  const staffData = useStaffDashboardData(
    isStaffRole ? tenantId : null,
    isStaffRole ? (user?.uid ?? null) : null,
    isStaffRole ? user?.claims.branchId ?? null : null,
    hasCommissionFeature,
    staffDoc?.commissionRate ?? 0
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-neutral-900">
          {t("dashboard.welcome")}
          {user?.displayName ? `, ${user.displayName}` : ""}
        </h1>
      </div>

      {isStaffRole ? (
        <StaffDashboard
          summary={staffData.summary}
          todayDeliveries={staffData.todayDeliveries}
          hasCommissionFeature={hasCommissionFeature}
          isLoading={staffData.isLoading}
        />
      ) : (
        <AdminDashboard
          kpis={adminData.kpis}
          todayDeliveries={adminData.todayDeliveries}
          tomorrowDeliveries={adminData.tomorrowDeliveries}
          monthlyChartData={adminData.monthlyChartData}
          dailyCollectionData={adminData.dailyCollectionData}
          branches={adminData.branches}
          selectedBranchId={selectedBranchId}
          onBranchChange={setSelectedBranchId}
          showBranchFilter={role === "tenant_admin"}
          hasNetProfitFeature={hasNetProfitFeature}
          isLoading={adminData.isLoading}
        />
      )}
    </div>
  );
}
