"use client";

import { useTranslations } from "next-intl";
import { MonthlyOrdersBarChart, MonthlyRevenueLineChart } from "@/components/tenant/dashboard/monthly-charts";
import { LockedFeatureNotice } from "@/components/shared/locked-feature-notice";
import { computeMonthlyChartSeries } from "@/lib/firebase/dashboard";
import type { Order } from "@/lib/types/customer";

const TREND_MONTHS = 8;

interface CustomerTrendTabProps {
  orders: Order[];
  isLoading: boolean;
  /** From tenant.planFeatures (via computeEffectiveFeatures) — resolved by the profile page, not this component. */
  hasAdvancedReports: boolean;
}

export function CustomerTrendTab({ orders, isLoading, hasAdvancedReports }: CustomerTrendTabProps) {
  const t = useTranslations();

  if (!hasAdvancedReports) {
    return <LockedFeatureNotice messageKey="customers.trendLocked" />;
  }

  const series = computeMonthlyChartSeries(orders, TREND_MONTHS);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MonthlyOrdersBarChart title={t("customers.trendOrdersTitle")} data={series} isLoading={isLoading} />
      <MonthlyRevenueLineChart title={t("customers.trendRevenueTitle")} data={series} isLoading={isLoading} />
    </div>
  );
}
