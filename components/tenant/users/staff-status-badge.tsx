"use client";

import { useTranslations } from "next-intl";
import { STAFF_ACTIVE_CLASS, STAFF_INACTIVE_CLASS } from "@/lib/constants/status-colors";

interface StaffStatusBadgeProps {
  isActive: boolean;
}

export function StaffStatusBadge({ isActive }: StaffStatusBadgeProps) {
  const t = useTranslations("users");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? STAFF_ACTIVE_CLASS : STAFF_INACTIVE_CLASS
      }`}
    >
      {isActive ? t("status.active") : t("status.inactive")}
    </span>
  );
}
