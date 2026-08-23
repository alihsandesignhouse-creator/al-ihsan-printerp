"use client";

import { useTranslations } from "next-intl";
import type { StaffRole } from "@/lib/types/user";
import { ROLE_BADGE_CLASSES, ROLE_BADGE_FALLBACK_CLASS } from "@/lib/constants/status-colors";

interface RoleBadgeProps {
  role: StaffRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const t = useTranslations("users");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        ROLE_BADGE_CLASSES[role] ?? ROLE_BADGE_FALLBACK_CLASS
      }`}
    >
      {t(`role.${role}`)}
    </span>
  );
}
