"use client";

import { AlertCircle, Phone, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TrialBannerLevel } from "@/lib/hooks/use-trial-status";

interface TrialBannerProps {
  daysLeft: number;
  level: TrialBannerLevel;
  contactPhone: string;
}

const LEVEL_STYLES: Record<TrialBannerLevel, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  danger: "bg-red-50 border-red-200 text-red-800",
};

const ICON_STYLES: Record<TrialBannerLevel, string> = {
  info: "text-blue-600",
  warning: "text-amber-600",
  danger: "text-red-600",
};

function getMessageKey(daysLeft: number): string {
  if (daysLeft >= 3) return "trial.banner3days";
  if (daysLeft === 2) return "trial.banner2days";
  if (daysLeft === 1) return "trial.banner1day";
  return "trial.banner0days";
}

/**
 * Non-dismissable trial banner shown above every page during the trial period.
 * Blueprint section 4.1 / T-01: cannot be closed by the user.
 */
export function TrialBanner({ daysLeft, level, contactPhone }: TrialBannerProps) {
  const t = useTranslations();
  const messageKey = getMessageKey(daysLeft);
  const whatsappHref = `https://wa.me/${contactPhone.replace(/^0/, "880")}`;
  const telHref = `tel:${contactPhone}`;

  return (
    <div
      role="status"
      className={`flex w-full flex-col gap-2 border-b px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between ${LEVEL_STYLES[level]}`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className={`h-4 w-4 shrink-0 ${ICON_STYLES[level]}`} aria-hidden="true" />
        <p className="text-sm font-medium">
          {t(messageKey)} <span className="font-normal">{t("trial.bannerContact")} {contactPhone}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={telHref}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-current/30 px-3 text-xs font-medium hover:bg-white/50"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          {t("trial.callBtn")}
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-current/30 px-3 text-xs font-medium hover:bg-white/50"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {t("trial.whatsappBtn")}
        </a>
      </div>
    </div>
  );
}
