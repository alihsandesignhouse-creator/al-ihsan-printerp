'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Pencil,
  CheckCircle,
  Check,
  PauseCircle,
  PlayCircle,
  Building2,
  CreditCard,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { TenantStatusBadge, PlanBadge, DaysLeftBadge } from '@/components/super-admin/TenantStatusBadge';
import { ActivateTenantModal } from '@/components/super-admin/ActivateTenantModal';
import { EditTenantModal } from '@/components/super-admin/EditTenantModal';
import { ConfirmDialog } from '@/components/super-admin/ConfirmDialog';
import {
  subscribeTenant,
  fetchSubscriptionHistory,
  fetchTenantAuditLogs,
  setTenantSuspended,
  computeTrialDaysLeft,
} from '@/lib/firebase/tenants';
import type { Tenant, AuditLog, SubscriptionRecord } from '@/lib/types/tenant';
import { ALL_FEATURE_KEYS } from '@/lib/types/tenant';
import { formatTaka } from '@/lib/utils/calculations';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';

// বাগ-ফিক্স (১৮ আগস্ট ২০২৬ লাইভ-অডিট): আগে এই পেজের নিজস্ব একটা স্থানীয়
// FEATURE_KEYS কপি ছিল যেটাতে `whatsappNotifications` বাদ পড়ে গিয়েছিল
// (EditTenantModal-এর টগল-তালিকায় ছিল, কিন্তু এই ডিটেল-পেজের Active
// Features লিস্টে দেখাত না)। এখন lib/types/tenant.ts-এর single-source-of-
// truth `ALL_FEATURE_KEYS` সরাসরি ব্যবহার করা হচ্ছে — নতুন কোনো ফিচার যোগ
// হলে দুই জায়গায় আলাদা করে মনে রেখে আপডেট করার দরকার নেই।

function InfoRow({ label, value }: { label: string; value: string | undefined | null }) {
  const t = useTranslations('sa.common');
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-neutral-50 last:border-0">
      <span className="text-xs text-neutral-500 w-36 shrink-0 pt-0.5">{label}</span>
      {/*
        বাগ-ফিক্স (২১ আগস্ট ২০২৬, মোবাইল-রেসপন্সিভ গভীর অডিট): এই span-এ
        আগে min-w-0/break-words ছিল না। flex-row-এর ভেতরে ডিফল্ট min-width
        "auto" বলে লম্বা ইমেইল/ঠিকানার মতো না-ভাঙা টেক্সট (যেমন
        "verylongownername@example.com") সরু মোবাইল স্ক্রিনে কনটেইনারের
        বাইরে উপচে পড়ত অথবা কাটা যেত — label-এর সাথে জড়িয়ে/ওভারল্যাপ
        করে দেখাত। min-w-0 (flex child-কে সংকুচিত হতে দেয়) + break-words
        (প্রয়োজনে শব্দের মাঝেও ভেঙে wrap করে) এখন এটা দ্বিতীয় লাইনে
        সুন্দরভাবে wrap করবে, কেটে/উপচে পড়বে না।
      */}
      <span className="min-w-0 flex-1 break-words text-sm text-neutral-800 font-medium">{value || t('notSet')}</span>
    </div>
  );
}

export default function TenantDetailPage() {
  const t = useTranslations('sa');
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const tenantId = params.tenantId as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [history, setHistory] = useState<SubscriptionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showActivate, setShowActivate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);

  // Realtime tenant subscription
  useEffect(() => {
    const unsub = subscribeTenant(
      tenantId,
      (data) => {
        setTenant(data);
        setLoading(false);
      },
      () => {
        setError(t('errors.fetchFailed'));
        setLoading(false);
      },
    );
    return unsub;
  }, [tenantId, t]);

  // Fetch history + audit logs once
  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      fetchSubscriptionHistory(tenantId),
      fetchTenantAuditLogs(tenantId, 30),
    ]).then(([hist, logs]) => {
      setHistory(hist);
      setAuditLogs(logs);
    }).catch(() => {
      // Non-critical — fail silently
    });
  }, [tenantId]);

  const handleSuspend = async () => {
    if (!tenant) return;
    setSuspendLoading(true);
    try {
      await setTenantSuspended(tenant.id, true);
      toast.success(t('suspend.success'));
      setShowSuspend(false);
    } catch {
      toast.error(t('suspend.error'));
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!tenant) return;
    setSuspendLoading(true);
    try {
      await setTenantSuspended(tenant.id, false);
      toast.success(t('suspend.success'));
      setShowReactivate(false);
    } catch {
      toast.error(t('suspend.error'));
    } finally {
      setSuspendLoading(false);
    }
  };

  const formatDate = (ts: Tenant['createdAt'] | null) => {
    if (!ts) return null;
    return ts.toDate().toLocaleDateString('bn-BD', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const daysLeft = tenant ? computeTrialDaysLeft(tenant) : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 text-sm">{error ?? t('errors.fetchFailed')}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-red-700"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9 text-neutral-500"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
              {tenant.name}
              <TenantStatusBadge status={tenant.subscriptionStatus} isTrial={tenant.isTrial} />
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">{tenant.ownerName}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {(tenant.subscriptionStatus === 'trial' || tenant.subscriptionStatus === 'expired') && (
            <Button
              onClick={() => setShowActivate(true)}
              size="sm"
              className="bg-status-success hover:bg-status-success/90 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              {t('tenants.actions.activate')}
            </Button>
          )}
          <Button
            onClick={() => setShowEdit(true)}
            size="sm"
            variant="outline"
          >
            <Pencil className="w-4 h-4 mr-1.5" />
            {t('tenants.actions.edit')}
          </Button>
          {tenant.subscriptionStatus === 'suspended' ? (
            <Button
              onClick={() => setShowReactivate(true)}
              size="sm"
              className="bg-brand-secondary hover:bg-brand-secondary/90 text-white"
            >
              <PlayCircle className="w-4 h-4 mr-1.5" />
              {t('tenants.actions.reactivate')}
            </Button>
          ) : tenant.subscriptionStatus === 'active' ? (
            <Button
              onClick={() => setShowSuspend(true)}
              size="sm"
              className="bg-status-warning hover:bg-status-warning/90 text-white"
            >
              <PauseCircle className="w-4 h-4 mr-1.5" />
              {t('tenants.actions.suspend')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Info + Subscription */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Info */}
          <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-brand-primary" />
              {t('tenantDetail.info')}
            </h2>
            <InfoRow label={t('tenantDetail.fields.pressName')} value={tenant.name} />
            <InfoRow label={t('tenantDetail.fields.ownerName')} value={tenant.ownerName} />
            <InfoRow label={t('tenantDetail.fields.email')} value={tenant.email} />
            <InfoRow label={t('tenantDetail.fields.phone')} value={tenant.phone} />
            <InfoRow label={t('tenantDetail.fields.district')} value={tenant.district} />
            <InfoRow label={t('tenantDetail.fields.address')} value={tenant.address} />
            <InfoRow
              label={t('tenantDetail.fields.signupSource')}
              value={t(`tenantDetail.signupSources.${tenant.signupSource}`)}
            />
            <InfoRow
              label={t('tenantDetail.fields.createdAt')}
              value={formatDate(tenant.createdAt) ?? ''}
            />
            <InfoRow label={t('tenantDetail.fields.orderIdPrefix')} value={tenant.orderIdPrefix} />
          </div>

          {/* Subscription Info */}
          <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-brand-primary" />
              {t('tenantDetail.subscription')}
            </h2>
            <InfoRow
              label={t('tenantDetail.fields.plan')}
              value={t(`tenants.plan.${tenant.planId}`)}
            />
            <InfoRow
              label={t('tenantDetail.fields.subscriptionEnds')}
              value={tenant.subscriptionEndsAt ? formatDate(tenant.subscriptionEndsAt) ?? '' : ''}
            />
            {tenant.subscriptionStatus === 'trial' && daysLeft !== null && (
              <div className="flex items-start gap-2 py-2.5 border-b border-neutral-50">
                <span className="text-xs text-neutral-500 w-36 shrink-0 pt-0.5">{t('tenantDetail.timeRemaining')}</span>
                <DaysLeftBadge days={daysLeft} />
              </div>
            )}
            <InfoRow
              label={t('tenantDetail.fields.activatedBy')}
              // বাগ-ফিক্স (১৮ আগস্ট ২০২৬ লাইভ-অডিট): raw UID-এর বদলে ইমেইল
              // দেখানো হয় এখন। এই ফিক্সের আগে activate/create হওয়া পুরনো
              // টেন্যান্টে `activatedByEmail` নেই — সেক্ষেত্রে raw UID-তে
              // fallback করে (নতুন করে activate করলে ঠিক হয়ে যাবে)।
              value={tenant.activatedByEmail || tenant.activatedBy || ''}
            />
            <InfoRow
              label={t('tenantDetail.fields.activatedAt')}
              value={tenant.activatedAt ? formatDate(tenant.activatedAt) ?? '' : ''}
            />
            {tenant.paymentNotes && (
              <InfoRow
                label={t('tenantDetail.fields.paymentNotes')}
                value={tenant.paymentNotes}
              />
            )}
          </div>

          {/* Subscription History */}
          <div className="bg-white rounded-xl border border-neutral-100 shadow-sm">
            <div className="px-5 py-4 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-brand-primary" />
                {t('tenantDetail.subscriptionHistory')}
              </h2>
            </div>
            {history.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-neutral-400">
                {t('tenantDetail.noHistory')}
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {history.map((h) => (
                  <div key={h.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <PlanBadge planId={h.planId} />
                      <span className="text-xs text-neutral-500">
                        {h.startedAt.toDate().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })}
                        {' → '}
                        {h.endsAt.toDate().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {typeof h.amountReceived === 'number' && (
                      <p className="text-xs text-green-700 font-medium mt-1">
                        {t('activateTenant.fields.amountReceived')}: {formatTaka(h.amountReceived)}
                        {h.discountValue ? (
                          <span className="text-neutral-400 font-normal">
                            {' '}
                            ({t('activateTenant.fields.discountValue')}: {h.discountType === 'percent' ? `${h.discountValue}%` : formatTaka(h.discountValue)})
                          </span>
                        ) : null}
                      </p>
                    )}
                    {h.paymentNotes && (
                      <p className="text-xs text-neutral-500 mt-1">{h.paymentNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Log */}
          <div className="bg-white rounded-xl border border-neutral-100 shadow-sm">
            <div className="px-5 py-4 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-primary" />
                {t('tenantDetail.auditLog')}
              </h2>
            </div>
            {auditLogs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-neutral-400">
                {t('tenantDetail.noAuditLogs')}
              </div>
            ) : (
              <div className="divide-y divide-neutral-50 max-h-72 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-mono text-neutral-700 font-medium">{log.action}</p>
                        <p className="text-xs text-neutral-500">{log.userEmail}</p>
                      </div>
                      <span className="text-[10px] text-neutral-400 shrink-0">
                        {log.createdAt.toDate().toLocaleDateString('bn-BD', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Features */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-4">
              {t('tenantDetail.features')}
            </h2>
            <div className="space-y-1.5">
              {ALL_FEATURE_KEYS.map((key) => {
                const enabled = tenant.planFeatures[key] || (tenant.featureOverrides?.[key] ?? false);
                const isOverride = !tenant.planFeatures[key] && (tenant.featureOverrides?.[key] ?? false);
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-2 ${enabled ? 'bg-green-50' : 'bg-neutral-50'}`}
                  >
                    <span className={`text-xs ${enabled ? 'text-green-800 font-medium' : 'text-neutral-400'}`}>
                      {t(`features.${key}`)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isOverride && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 rounded px-1 font-medium">
                          {t('editTenant.overrideBadge')}
                        </span>
                      )}
                      <span className={`text-xs font-semibold ${enabled ? 'text-green-600' : 'text-neutral-300'}`}>
                        {enabled ? <Check className="w-3.5 h-3.5 inline" /> : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ActivateTenantModal
        open={showActivate}
        onOpenChange={setShowActivate}
        tenant={tenant}
        onSuccess={() => {}}
        adminId={user?.uid ?? ''}
        adminEmail={user?.email ?? ''}
      />
      <EditTenantModal
        open={showEdit}
        onOpenChange={setShowEdit}
        tenant={tenant}
        onSuccess={() => {}}
        adminId={user?.uid ?? ''}
      />
      <ConfirmDialog
        open={showSuspend}
        onOpenChange={setShowSuspend}
        title={t('suspend.confirmTitle')}
        description={t('suspend.confirmMessage')}
        confirmLabel={t('suspend.confirm')}
        cancelLabel={t('suspend.cancel')}
        onConfirm={handleSuspend}
        destructive
        loading={suspendLoading}
      />
      <ConfirmDialog
        open={showReactivate}
        onOpenChange={setShowReactivate}
        title={t('suspend.reactivateTitle')}
        description={t('suspend.reactivateMessage')}
        confirmLabel={t('suspend.reactivateConfirm')}
        cancelLabel={t('suspend.cancel')}
        onConfirm={handleReactivate}
        loading={suspendLoading}
      />
    </div>
  );
}
