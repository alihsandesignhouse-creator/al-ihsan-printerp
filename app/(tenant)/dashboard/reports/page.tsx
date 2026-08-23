"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Printer } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffectiveBranchId } from "@/lib/hooks/use-effective-branch-id";
import { useReportsData } from "@/lib/hooks/use-reports-data";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { formatDateLocalized } from "@/lib/utils/format";
import { LockedFeatureNotice } from "@/components/shared/locked-feature-notice";
import { BranchFilter } from "@/components/tenant/dashboard/branch-filter";
import { DateRangeFilter, buildPresetRange } from "@/components/tenant/reports/date-range-filter";
import { FinancialKpiCards } from "@/components/tenant/reports/financial-kpi-cards";
import { BranchComparisonTable } from "@/components/tenant/reports/branch-comparison-table";
import { ItemAnalysisTable } from "@/components/tenant/reports/item-analysis-table";
import { CustomerAnalysisSection } from "@/components/tenant/reports/customer-analysis-section";
import { StaffPerformanceTable } from "@/components/tenant/reports/staff-performance-table";
import { ExpenseAnalysisSection } from "@/components/tenant/reports/expense-analysis-section";
import { ExportCsvButton } from "@/components/tenant/reports/export-csv-button";
import { Button } from "@/components/ui/button";
import type { Tenant } from "@/lib/types/tenant";
import type { ReportDateRange } from "@/lib/types/report";

function formatRangeDate(date: Date, locale: string): string {
  return formatDateLocalized(date, locale, { day: "numeric", month: "long", year: "numeric" });
}

export default function ReportsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);

  const role = user?.claims.role ?? "regular_staff";
  const tenantId = user?.claims.tenantId ?? null;
  const effectiveBranchId = useEffectiveBranchId();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [range, setRange] = useState<ReportDateRange>(() => buildPresetRange("thisMonth"));
  const handleFirestoreError = useFirestoreErrorHandler();

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(tenantId, setTenant, handleFirestoreError());
    return unsub;
  }, [tenantId, handleFirestoreError]);

  const features = tenant ? computeEffectiveFeatures(tenant.planId, tenant.featureOverrides, tenant.planFeatures) : null;
  const hasAdvancedReports = features?.advancedReports ?? false;
  const hasCommissionFeature = features?.commissionSystem ?? false;
  const hasDataExportFeature = features?.dataExport ?? false;

  const data = useReportsData(tenantId, effectiveBranchId, range, hasAdvancedReports, hasCommissionFeature);

  const rangeLabel = `${formatRangeDate(range.start, locale)} — ${formatRangeDate(range.end, locale)}`;
  const showBranchComparison = role === "tenant_admin" && selectedBranchId === "all" && data.branches.length > 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("reports.pageTitle")}</h1>
        {tenant && hasAdvancedReports && (
          <div data-print-hide className="flex items-center gap-2">
            <ExportCsvButton
              hasDataExportFeature={hasDataExportFeature}
              rangeLabel={rangeLabel}
              kpis={data.kpis}
              branchComparison={data.branchComparison}
              itemAnalysis={data.itemAnalysis}
              staffPerformance={data.staffPerformance}
              expenseCategoryBreakdown={data.expenseCategoryBreakdown}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t("common.print")}
            </Button>
          </div>
        )}
      </div>

      {!tenant ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      ) : !hasAdvancedReports ? (
        <LockedFeatureNotice messageKey="reports.locked" />
      ) : (
        <div className="space-y-6">
          <div data-print-hide className="flex flex-wrap items-center justify-between gap-3">
            <DateRangeFilter range={range} onChange={setRange} />
            {role === "tenant_admin" && (
              <BranchFilter branches={data.branches} selectedBranchId={selectedBranchId} onChange={setSelectedBranchId} />
            )}
          </div>

          <p className="text-sm text-neutral-500">{rangeLabel}</p>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-neutral-700">{t("reports.financialSummary")}</h2>
            <FinancialKpiCards kpis={data.kpis} isLoading={data.isLoading} />
          </section>

          {showBranchComparison && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-neutral-700">{t("reports.branchComparison")}</h2>
              <BranchComparisonTable rows={data.branchComparison} isLoading={data.isLoading} />
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-neutral-700">{t("reports.itemAnalysis")}</h2>
            <ItemAnalysisTable result={data.itemAnalysis} isLoading={data.isLoading || data.itemAnalysisLoading} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-neutral-700">{t("reports.customerAnalysis")}</h2>
            <CustomerAnalysisSection
              leaderboards={data.rangeCustomerLeaderboards}
              topDueCustomers={data.topDueCustomers}
              inactiveCustomers={data.inactiveCustomers}
              isLoading={data.isLoading}
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-neutral-700">{t("reports.staffPerformance")}</h2>
            <StaffPerformanceTable rows={data.staffPerformance} isLoading={data.isLoading} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-neutral-700">{t("reports.expenseAnalysis")}</h2>
            <ExpenseAnalysisSection
              categoryBreakdown={data.expenseCategoryBreakdown}
              monthlyTrend={data.expenseMonthlyTrend}
              isLoading={data.isLoading}
            />
          </section>
        </div>
      )}
    </div>
  );
}
