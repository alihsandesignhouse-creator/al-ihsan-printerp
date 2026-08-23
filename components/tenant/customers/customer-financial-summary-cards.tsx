"use client";

import { useTranslations } from "next-intl";
import { Wallet, CreditCard, Receipt } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { formatTaka } from "@/lib/utils/calculations";
import type { CustomerFinancialSummary } from "@/lib/types/customer";

interface CustomerFinancialSummaryCardsProps {
  financials: CustomerFinancialSummary;
  isLoading: boolean;
}

export function CustomerFinancialSummaryCards({
  financials,
  isLoading,
}: CustomerFinancialSummaryCardsProps) {
  const t = useTranslations();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        label={t("customers.totalBilled")}
        value={formatTaka(financials.totalBilled)}
        icon={Receipt}
        accentColor="primary"
        isLoading={isLoading}
      />
      <KpiCard
        label={t("customers.totalPaid")}
        value={formatTaka(financials.totalPaid)}
        icon={CreditCard}
        accentColor="success"
        isLoading={isLoading}
      />
      <KpiCard
        label={t("customers.totalDue")}
        value={formatTaka(financials.totalDue)}
        icon={Wallet}
        accentColor={financials.totalDue > 0 ? "danger" : "success"}
        isLoading={isLoading}
      />
    </div>
  );
}
