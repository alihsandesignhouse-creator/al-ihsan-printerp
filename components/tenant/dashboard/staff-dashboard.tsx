"use client";

import { useTranslations } from "next-intl";
import { ClipboardList, Wallet, CreditCard, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { DeliverySection } from "./delivery-section";
import type { StaffDashboardSummary, DeliveryHighlight } from "@/lib/types/dashboard";
import { formatTaka } from "@/lib/utils/calculations";

interface StaffDashboardProps {
  summary: StaffDashboardSummary;
  todayDeliveries: DeliveryHighlight[];
  hasCommissionFeature: boolean;
  isLoading: boolean;
}

export function StaffDashboard({
  summary,
  todayDeliveries,
  hasCommissionFeature,
  isLoading,
}: StaffDashboardProps) {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-neutral-500">{t("dashboard.staffDashboard")}</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={t("dashboard.myOrders")}
          value={String(summary.myOrderCount)}
          icon={ClipboardList}
          accentColor="primary"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.totalDue")}
          value={formatTaka(summary.myDueAmount)}
          icon={Wallet}
          accentColor="warning"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.myCollection")}
          value={formatTaka(summary.myCollectionThisMonth)}
          icon={CreditCard}
          accentColor="success"
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.myCommission")}
          value={
            summary.myCommissionThisMonth !== null
              ? formatTaka(summary.myCommissionThisMonth)
              : ""
          }
          icon={TrendingUp}
          accentColor="info"
          locked={!hasCommissionFeature}
          lockedLabel={t("dashboard.standardPlusOnly")}
          isLoading={isLoading}
        />
      </div>

      <DeliverySection
        title={t("dashboard.todayDeliveries")}
        deliveries={todayDeliveries}
        emptyMessage={t("dashboard.noTodayDeliveries")}
        isLoading={isLoading}
      />
    </div>
  );
}
