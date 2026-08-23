"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { PLAN_STAFF_LIMITS } from "@/lib/types/user";
import type { PlanId } from "@/lib/types/tenant";

interface StaffLimitBannerProps {
  planId: PlanId;
  isTrial: boolean;
  activeCount: number;
}

export function StaffLimitBanner({ planId, isTrial, activeCount }: StaffLimitBannerProps) {
  const t = useTranslations("users");

  // Trial tenants get premium (unlimited) features during trial
  const limit = isTrial ? Infinity : (PLAN_STAFF_LIMITS[planId] ?? PLAN_STAFF_LIMITS.basic);
  const isUnlimited = limit === Infinity;
  const isNearLimit = !isUnlimited && activeCount >= limit - 1;
  const isAtLimit = !isUnlimited && activeCount >= limit;

  const bgClass = isAtLimit
    ? "bg-red-50 border-red-200 text-red-700"
    : isNearLimit
    ? "bg-amber-50 border-amber-200 text-amber-700"
    : "bg-blue-50 border-blue-200 text-blue-700";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${bgClass}`}
      role="status"
    >
      <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {isUnlimited
          ? t("staffLimit.unlimited", { count: activeCount })
          : t("staffLimit.limited", {
              count: activeCount,
              max: limit,
            })}
        {isAtLimit && (
          <span className="ml-1 font-semibold">{t("staffLimit.atLimit")}</span>
        )}
      </span>
    </div>
  );
}
