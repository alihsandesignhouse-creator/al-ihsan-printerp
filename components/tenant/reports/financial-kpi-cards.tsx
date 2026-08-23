"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, Wallet, Calculator, Receipt, LineChart, Landmark, ClipboardList } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { formatTaka } from "@/lib/utils/calculations";
import type { FinancialReportKpis } from "@/lib/types/report";

interface FinancialKpiCardsProps {
  kpis: FinancialReportKpis;
  isLoading: boolean;
}

/**
 * blueprint T-18: "মোট আয় − মোট কস্টিং = গ্রস মুনাফা, গ্রস মুনাফা − মোট খরচ = নেট মুনাফা, মোট বকেয়া"।
 *
 * Drilldown (সেশন ৬, ১৮ আগস্ট ২০২৬): যে কার্ডের পেছনে একটা নির্দিষ্ট তালিকা
 * পেজ আছে (অর্ডার/পেমেন্ট/কস্টিং/খরচ) সেটায় href যোগ করা হয়েছে —
 * shared/kpi-card.tsx-এর বিদ্যমান মেকানিজম ব্যবহার করে। গ্রস মুনাফা ও নেট
 * মুনাফা ইচ্ছাকৃতভাবে non-clickable রাখা হয়েছে — এগুলো derived সংখ্যা,
 * এর পেছনে কোনো একক তালিকা পেজ নেই যা এই মানটাই দেখায়।
 */
export function FinancialKpiCards({ kpis, isLoading }: FinancialKpiCardsProps) {
  const t = useTranslations();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <KpiCard
        label={t("reports.orderCount")}
        value={String(kpis.orderCount)}
        icon={ClipboardList}
        accentColor="primary"
        isLoading={isLoading}
        href="/dashboard/orders"
      />
      <KpiCard
        label={t("reports.totalRevenue")}
        value={formatTaka(kpis.totalRevenue)}
        icon={TrendingUp}
        accentColor="info"
        isLoading={isLoading}
        href="/dashboard/orders"
      />
      <KpiCard
        label={t("reports.totalCollection")}
        value={formatTaka(kpis.totalCollection)}
        icon={Wallet}
        accentColor="success"
        isLoading={isLoading}
        href="/dashboard/payments"
      />
      <KpiCard
        label={t("reports.totalCosting")}
        value={formatTaka(kpis.totalCosting)}
        icon={Calculator}
        accentColor="warning"
        isLoading={isLoading}
        href="/dashboard/costing"
      />
      <KpiCard
        label={t("reports.grossProfit")}
        value={formatTaka(kpis.grossProfit)}
        icon={LineChart}
        accentColor={kpis.grossProfit >= 0 ? "success" : "danger"}
        isLoading={isLoading}
      />
      <KpiCard
        label={t("reports.totalExpense")}
        value={formatTaka(kpis.totalExpense)}
        icon={Receipt}
        accentColor="warning"
        isLoading={isLoading}
        href="/dashboard/expenses"
      />
      <KpiCard
        label={t("reports.netProfit")}
        value={formatTaka(kpis.netProfit)}
        icon={Landmark}
        accentColor={kpis.netProfit >= 0 ? "success" : "danger"}
        isLoading={isLoading}
      />
      <KpiCard
        label={t("reports.totalDue")}
        value={formatTaka(kpis.totalDue)}
        icon={Wallet}
        accentColor="danger"
        isLoading={isLoading}
        href="/dashboard/orders?filter=due"
      />
    </div>
  );
}
