"use client";

import { useTranslations } from "next-intl";
import type { WithdrawalStatus } from "@/lib/types/commission";
import { WITHDRAWAL_STATUS_CLASSES } from "@/lib/constants/status-colors";

interface WithdrawalStatusBadgeProps {
  status: WithdrawalStatus;
  className?: string;
}

export function WithdrawalStatusBadge({ status, className = "" }: WithdrawalStatusBadgeProps) {
  const t = useTranslations();
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${WITHDRAWAL_STATUS_CLASSES[status]} ${className}`}
    >
      {t(`commission.withdrawalStatus.${status}`)}
    </span>
  );
}
