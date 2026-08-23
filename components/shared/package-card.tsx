"use client";

import { Check } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import type { SubscriptionPlanCatalogEntry } from "@/lib/types/subscription-plan";

interface PackageCardProps {
  plan: SubscriptionPlanCatalogEntry;
  highlighted?: boolean;
}

const TIER_BADGE_STYLES: Record<string, string> = {
  basic: "bg-blue-50 text-blue-700",
  standard: "bg-brand-primary/10 text-brand-primary",
  premium: "bg-amber-50 text-amber-700",
};

/**
 * Renders one plan from the Super-Admin-managed catalog (Module SA-03,
 * `/subscription_plans/{planId}`) — price, limits, and feature bullets all
 * come from that live Firestore data (with DEFAULT_PLAN_CATALOG fallback
 * baked in upstream by getSubscriptionPlansOnce/subscribeSubscriptionPlans),
 * not from static packages.* i18n strings anymore.
 */
export function PackageCard({ plan, highlighted = false }: PackageCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const features = locale === "bn" ? plan.featuresBn : plan.featuresEn;
  const formatMoney = (n: number) => `৳${n.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;

  return (
    <div
      className={`flex flex-col rounded-xl border p-5 ${
        highlighted
          ? "border-brand-primary shadow-sm ring-1 ring-brand-primary"
          : "border-neutral-200"
      }`}
    >
      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_BADGE_STYLES[plan.id] ?? ""}`}
      >
        {t(`packages.${plan.id}`)}
      </span>

      <div className="mt-3">
        <span className="text-2xl font-semibold text-neutral-900">{formatMoney(plan.monthlyPrice)}</span>
        <span className="text-sm text-neutral-400">{t("packages.perMonth")}</span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-400">
        {formatMoney(plan.yearlyPrice)} {t("packages.perYear")}
      </p>

      <div className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
        <p>
          {t("packages.staffLimit")}:{" "}
          <span className="font-medium text-neutral-700">
            {plan.maxStaff === null ? t("packages.unlimited") : `${plan.maxStaff} ${t("packages.persons")}`}
          </span>
        </p>
        <p>
          {t("packages.branchLimit")}:{" "}
          <span className="font-medium text-neutral-700">
            {plan.maxBranches === null ? t("packages.unlimited") : `${plan.maxBranches} ${t("packages.branches")}`}
          </span>
        </p>
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-neutral-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
