"use client";

import { useTranslations } from "next-intl";
import {
  ClipboardList,
  Clock,
  PackageCheck,
  Wallet,
  CreditCard,
  TrendingUp,
  Receipt,
  BarChart3,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { DeliverySection } from "./delivery-section";
import { BranchFilter } from "./branch-filter";
import { MonthlyOrdersBarChart, MonthlyRevenueLineChart } from "./monthly-charts";
import { DailyCollectionChart } from "./daily-collection-chart";
import { formatTaka } from "@/lib/utils/calculations";
import type {
  DashboardKpis,
  DeliveryHighlight,
  MonthlyChartPoint,
  DailyCollectionPoint,
  Branch,
} from "@/lib/types/dashboard";

interface AdminDashboardProps {
  kpis: DashboardKpis;
  todayDeliveries: DeliveryHighlight[];
  tomorrowDeliveries: DeliveryHighlight[];
  monthlyChartData: MonthlyChartPoint[];
  dailyCollectionData: DailyCollectionPoint[];
  branches: Branch[];
  selectedBranchId: string | "all";
  onBranchChange: (branchId: string | "all") => void;
  showBranchFilter: boolean;
  hasNetProfitFeature: boolean;
  isLoading: boolean;
}

export function AdminDashboard({
  kpis,
  todayDeliveries,
  tomorrowDeliveries,
  monthlyChartData,
  dailyCollectionData,
  branches,
  selectedBranchId,
  onBranchChange,
  showBranchFilter,
  hasNetProfitFeature,
  isLoading,
}: AdminDashboardProps) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {showBranchFilter && (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-500">{t("dashboard.title")}</h2>
          <BranchFilter
            branches={branches}
            selectedBranchId={selectedBranchId}
            onChange={onBranchChange}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label={t("dashboard.totalOrders")}
          value={String(kpis.totalOrders)}
          icon={ClipboardList}
          href="/dashboard/orders"
          accentColor="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.activeOrders")}
          value={String(kpis.activeOrders)}
          icon={Clock}
          href="/dashboard/orders?filter=active"
          accentColor="warning"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.deliveredThisMonth")}
          value={String(kpis.deliveredThisMonth)}
          icon={PackageCheck}
          href="/dashboard/orders?status=delivered"
          accentColor="success"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.totalDue")}
          value={formatTaka(kpis.totalDue)}
          icon={Wallet}
          href="/dashboard/orders?filter=due"
          accentColor="danger"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.todayCollection")}
          value={formatTaka(kpis.todayCollection)}
          icon={CreditCard}
          href="/dashboard/payments?range=today"
          accentColor="success"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.monthlyRevenue")}
          value={formatTaka(kpis.monthlyRevenue)}
          icon={TrendingUp}
          href="/dashboard/reports"
          accentColor="info"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.monthlyExpense")}
          value={kpis.monthlyExpense !== null ? formatTaka(kpis.monthlyExpense) : ""}
          icon={Receipt}
          href={kpis.monthlyExpense !== null ? "/dashboard/expenses" : undefined}
          accentColor="warning"
          locked={!hasNetProfitFeature}
          lockedLabel={t("dashboard.standardPlusOnly")}
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.netProfit")}
          value={kpis.netProfit !== null ? formatTaka(kpis.netProfit) : ""}
          icon={BarChart3}
          href={kpis.netProfit !== null ? "/dashboard/reports" : undefined}
          accentColor="primary"
          locked={!hasNetProfitFeature}
          lockedLabel={t("dashboard.standardPlusOnly")}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DeliverySection
          title={t("dashboard.todayDeliveries")}
          deliveries={todayDeliveries}
          emptyMessage={t("dashboard.noTodayDeliveries")}
          isLoading={isLoading}
        />
        <DeliverySection
          title={t("dashboard.tomorrowDeliveries")}
          deliveries={tomorrowDeliveries}
          emptyMessage={t("dashboard.noTomorrowDeliveries")}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MonthlyOrdersBarChart
          title={t("dashboard.monthlyOrders")}
          data={monthlyChartData}
          isLoading={isLoading}
        />
        <MonthlyRevenueLineChart
          title={t("dashboard.monthlyRevenueTrend")}
          data={monthlyChartData}
          isLoading={isLoading}
        />
        <DailyCollectionChart
          title={t("dashboard.dailyCollection")}
          data={dailyCollectionData}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
