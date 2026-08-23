'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Users,
  Clock,
  AlertCircle,
  XCircle,
  PauseCircle,
  UserPlus,
  CheckCircle2,
  CalendarClock,
} from 'lucide-react';
import { KpiCard } from '@/components/shared/kpi-card';
import { TenantStatusBadge, PlanBadge, DaysLeftBadge } from '@/components/super-admin/TenantStatusBadge';
import {
  fetchSuperAdminKpis,
  subscribeTenants,
  computeTrialDaysLeft,
  type SuperAdminKpis,
} from '@/lib/firebase/tenants';
import type { Tenant } from '@/lib/types/tenant';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function SuperAdminDashboardPage() {
  const t = useTranslations('sa');
  const router = useRouter();

  const [kpis, setKpis] = useState<SuperAdminKpis | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load KPIs
  useEffect(() => {
    fetchSuperAdminKpis()
      .then(setKpis)
      .catch(() => setError(t('errors.fetchFailed')))
      .finally(() => setLoadingKpis(false));
  }, [t]);

  // Subscribe to tenant list (realtime)
  useEffect(() => {
    const unsub = subscribeTenants(
      (data) => { setTenants(data); setLoadingTenants(false); },
      () => { setError(t('errors.fetchFailed')); setLoadingTenants(false); },
    );
    return unsub;
  }, [t]);

  const trialTenants = tenants
    .filter((t) => t.subscriptionStatus === 'trial' && t.isActive)
    .slice(0, 6);

  const recentTenants = tenants.slice(0, 6);

  const formatDate = (ts: Tenant['createdAt']) =>
    ts.toDate().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-8">
      {/*
        বাগ-ফিক্স (২১ আগস্ট ২০২৬): বাটনটা এখন মোবাইলে সম্পূর্ণ হাইড
        (bottom-nav দিয়ে এমনিতেই Tenants-এ যাওয়া যায়, ডুপ্লিকেট ছিল) —
        তাই flex-wrap-এর দরকার আর নেই, শুধু শিরোনাম+তারিখ মোবাইলে দেখাবে।
      */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t('dashboard.title')}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {new Date().toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button
          onClick={() => router.push('/super-admin/tenants')}
          className="hidden bg-brand-primary hover:bg-brand-primary/90 text-white sm:inline-flex"
        >
          <Users className="w-4 h-4 mr-2" />
          {t('nav.tenants')}
        </Button>
      </div>

      {/* KPI Cards */}
      {loadingKpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 text-red-700 underline"
            onClick={() => window.location.reload()}
          >
            {t('common.refresh')}
          </Button>
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            label={t('dashboard.totalActive')}
            value={kpis.totalActive}
            icon={CheckCircle2}
            iconColor="text-green-600"
            bgColor="bg-green-50"
            onClick={() => router.push('/super-admin/tenants?tab=active')}
          />
          <KpiCard
            label={t('dashboard.trialRunning')}
            value={kpis.trialRunning}
            icon={Clock}
            iconColor="text-purple-600"
            bgColor="bg-purple-50"
            onClick={() => router.push('/super-admin/tenants?tab=trial')}
          />
          <KpiCard
            label={t('dashboard.expiringToday')}
            value={kpis.expiringToday}
            icon={AlertCircle}
            iconColor="text-amber-600"
            bgColor="bg-amber-50"
            onClick={() => router.push('/super-admin/tenants?tab=expiring_today')}
          />
          <KpiCard
            label={t('dashboard.expired')}
            value={kpis.expired}
            icon={XCircle}
            iconColor="text-red-600"
            bgColor="bg-red-50"
            onClick={() => router.push('/super-admin/tenants?tab=expired')}
          />
          <KpiCard
            label={t('dashboard.suspended')}
            value={kpis.suspended}
            icon={PauseCircle}
            iconColor="text-amber-700"
            bgColor="bg-amber-50"
            onClick={() => router.push('/super-admin/tenants?tab=suspended')}
          />
          <KpiCard
            label={t('dashboard.newThisMonth')}
            value={kpis.newThisMonth}
            icon={UserPlus}
            iconColor="text-blue-600"
            bgColor="bg-blue-50"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trial Tenants Highlight */}
        <div className="bg-white rounded-xl border border-neutral-100 shadow-sm">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-purple-600" />
              {t('dashboard.trialHighlights')}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-brand-primary"
              onClick={() => router.push('/super-admin/tenants?tab=trial')}
            >
              সব দেখুন
            </Button>
          </div>
          <div className="divide-y divide-neutral-50">
            {loadingTenants ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3">
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : trialTenants.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-neutral-400">
                {t('dashboard.noTrialTenants')}
              </div>
            ) : (
              trialTenants.map((tenant) => {
                const days = computeTrialDaysLeft(tenant);
                return (
                  <div
                    key={tenant.id}
                    className="px-5 py-3 flex items-center justify-between hover:bg-neutral-50 cursor-pointer"
                    onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{tenant.name}</p>
                      <p className="text-xs text-neutral-500">{tenant.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DaysLeftBadge days={days} />
                      <TenantStatusBadge status={tenant.subscriptionStatus} isTrial />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Registrations */}
        <div className="bg-white rounded-xl border border-neutral-100 shadow-sm">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-600" />
              {t('dashboard.recentRegistrations')}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-brand-primary"
              onClick={() => router.push('/super-admin/tenants')}
            >
              সব দেখুন
            </Button>
          </div>
          <div className="divide-y divide-neutral-50">
            {loadingTenants ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3">
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : recentTenants.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-neutral-400">
                {t('dashboard.noRecentTenants')}
              </div>
            ) : (
              recentTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-neutral-50 cursor-pointer"
                  onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{tenant.name}</p>
                    <p className="text-xs text-neutral-500">
                      {tenant.ownerName} · {formatDate(tenant.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PlanBadge planId={tenant.planId} />
                    <TenantStatusBadge
                      status={tenant.subscriptionStatus}
                      isTrial={tenant.isTrial}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
