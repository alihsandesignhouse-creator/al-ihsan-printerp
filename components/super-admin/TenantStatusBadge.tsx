'use client';

import { useTranslations } from 'next-intl';
import type { SubscriptionStatus } from '@/lib/types/tenant';
import { TENANT_STATUS_CLASSES, PLAN_BADGE_CLASSES, PLAN_BADGE_FALLBACK_CLASS } from '@/lib/constants/status-colors';

interface TenantStatusBadgeProps {
  status: SubscriptionStatus;
  isTrial?: boolean;
}

export function TenantStatusBadge({ status, isTrial }: TenantStatusBadgeProps) {
  const t = useTranslations('sa.tenants.status');
  const resolvedStatus: SubscriptionStatus = isTrial ? 'trial' : status;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TENANT_STATUS_CLASSES[resolvedStatus]}`}
    >
      {t(resolvedStatus)}
    </span>
  );
}

interface PlanBadgeProps {
  planId: string;
}

export function PlanBadge({ planId }: PlanBadgeProps) {
  const t = useTranslations('sa.tenants.plan');
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PLAN_BADGE_CLASSES[planId] ?? PLAN_BADGE_FALLBACK_CLASS}`}
    >
      {t(planId as 'basic' | 'standard' | 'premium')}
    </span>
  );
}

interface DaysLeftBadgeProps {
  days: number | null;
}

export function DaysLeftBadge({ days }: DaysLeftBadgeProps) {
  const t = useTranslations('sa.tenants');

  if (days === null) return null;

  let colorClass = 'text-blue-600 font-medium';
  if (days === 0) colorClass = 'text-red-600 font-semibold';
  else if (days === 1) colorClass = 'text-amber-600 font-semibold';

  return (
    <span className={`text-sm ${colorClass}`}>
      {days === 0
        ? t('today')
        : t('daysLeft', { days })}
    </span>
  );
}
