'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { TenantStatusBadge, PlanBadge, DaysLeftBadge } from '@/components/super-admin/TenantStatusBadge';
import { TenantActionsMenu } from '@/components/super-admin/TenantActionsMenu';
import { CreateTenantModal } from '@/components/super-admin/CreateTenantModal';
import { ActivateTenantModal } from '@/components/super-admin/ActivateTenantModal';
import { EditTenantModal } from '@/components/super-admin/EditTenantModal';
import { ConfirmDialog } from '@/components/super-admin/ConfirmDialog';
import { DeleteTenantModal } from '@/components/super-admin/DeleteTenantModal';
import {
  subscribeTenants,
  setTenantSuspended,
  computeTrialDaysLeft,
} from '@/lib/firebase/tenants';
import type { Tenant, TenantTab } from '@/lib/types/tenant';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';

const TABS: TenantTab[] = ['all', 'trial', 'expiring_today', 'expired', 'active', 'suspended'];

function filterByTab(tenants: Tenant[], tab: TenantTab): Tenant[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);

  switch (tab) {
    case 'all':
      return tenants;
    case 'trial':
      return tenants.filter((t) => t.subscriptionStatus === 'trial' && t.isActive);
    case 'expiring_today':
      return tenants.filter((t) => {
        if (t.subscriptionStatus !== 'trial' || !t.trialEndsAt) return false;
        const d = t.trialEndsAt.toDate();
        return d >= startOfToday && d < endOfToday;
      });
    case 'expired':
      return tenants.filter((t) => t.subscriptionStatus === 'expired');
    case 'active':
      return tenants.filter((t) => t.subscriptionStatus === 'active');
    case 'suspended':
      return tenants.filter((t) => t.subscriptionStatus === 'suspended');
    default:
      return tenants;
  }
}

function filterBySearch(tenants: Tenant[], query: string): Tenant[] {
  if (!query.trim()) return tenants;
  const q = query.toLowerCase();
  return tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.ownerName.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      (t.district ?? '').toLowerCase().includes(q),
  );
}

export default function TenantsPage() {
  const t = useTranslations('sa');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const initialTab = (searchParams.get('tab') as TenantTab) ?? 'all';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TenantTab>(initialTab);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [activateTenant, setActivateTenant] = useState<Tenant | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<Tenant | null>(null);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  // Realtime subscription
  useEffect(() => {
    const unsub = subscribeTenants(
      (data) => { setTenants(data); setLoading(false); },
      () => { setError(t('errors.fetchFailed')); setLoading(false); },
    );
    return unsub;
  }, [t]);

  // Filtered list
  const filtered = useMemo(() => {
    const byTab = filterByTab(tenants, activeTab);
    return filterBySearch(byTab, searchQuery);
  }, [tenants, activeTab, searchQuery]);

  // Tab counts
  const counts = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86400000);
    return {
      all: tenants.length,
      trial: tenants.filter((t) => t.subscriptionStatus === 'trial' && t.isActive).length,
      expiring_today: tenants.filter((t) => {
        if (t.subscriptionStatus !== 'trial' || !t.trialEndsAt) return false;
        const d = t.trialEndsAt.toDate();
        return d >= startOfToday && d < endOfToday;
      }).length,
      expired: tenants.filter((t) => t.subscriptionStatus === 'expired').length,
      active: tenants.filter((t) => t.subscriptionStatus === 'active').length,
      suspended: tenants.filter((t) => t.subscriptionStatus === 'suspended').length,
    };
  }, [tenants]);

  const handleSuspend = useCallback(async () => {
    if (!suspendTarget) return;
    setSuspendLoading(true);
    try {
      await setTenantSuspended(suspendTarget.id, true);
      toast.success(t('suspend.success'));
      setSuspendTarget(null);
    } catch {
      toast.error(t('suspend.error'));
    } finally {
      setSuspendLoading(false);
    }
  }, [suspendTarget, t]);

  const handleReactivate = useCallback(async () => {
    if (!reactivateTarget) return;
    setSuspendLoading(true);
    try {
      await setTenantSuspended(reactivateTarget.id, false);
      toast.success(t('suspend.success'));
      setReactivateTarget(null);
    } catch {
      toast.error(t('suspend.error'));
    } finally {
      setSuspendLoading(false);
    }
  }, [reactivateTarget, t]);

  return (
    <div className="space-y-6">
      {/* Header — বাগ-ফিক্স (২১ আগস্ট ২০২৬, সুপার-অ্যাডমিন মোবাইল অডিট):
          flex-wrap ছাড়া "টেন্যান্ট ব্যবস্থাপনা" শিরোনাম + "নতুন টেন্যান্ট"
          বাটন সরু স্ক্রিনে গাদাগাদি করত (dashboard/page.tsx-এর একই বাগ,
          দেখুন সেই ফাইলের কমেন্ট)। */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">{t('tenants.title')}</h1>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-brand-primary hover:bg-brand-primary/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('tenants.addNew')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('tenants.search')}
          className="pl-9 h-10 border-neutral-200"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TenantTab)}>
        <TabsList className="bg-neutral-100 gap-1 flex-wrap h-auto p-1">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="text-xs data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
            >
              {t(`tenants.tabs.${tab}`)}
              <span className="ml-1.5 text-[10px] bg-neutral-200 data-[state=active]:bg-brand-primary/10 data-[state=active]:text-brand-primary rounded-full px-1.5 py-0.5 font-semibold">
                {counts[tab]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center justify-between">
          {error}
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50 border-b border-neutral-100">
                <TableHead className="text-xs font-semibold text-neutral-600 uppercase tracking-wide pl-5">
                  {t('tenants.table.press')}
                </TableHead>
                <TableHead className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                  {t('tenants.table.contact')}
                </TableHead>
                <TableHead className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                  {t('tenants.table.package')}
                </TableHead>
                <TableHead className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                  {t('tenants.table.daysLeft')}
                </TableHead>
                <TableHead className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                  {t('tenants.table.status')}
                </TableHead>
                <TableHead className="text-xs font-semibold text-neutral-600 uppercase tracking-wide pr-5 text-right">
                  {t('tenants.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-neutral-400">
                    {t('tenants.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((tenant) => {
                  const daysLeft = computeTrialDaysLeft(tenant);
                  return (
                    <TableRow
                      key={tenant.id}
                      className="hover:bg-neutral-50/50 transition-colors border-b border-neutral-50 last:border-0"
                    >
                      <TableCell className="pl-5 py-4">
                        <div>
                          <p
                            className="text-sm font-medium text-neutral-900 cursor-pointer hover:text-brand-primary"
                            onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                          >
                            {tenant.name}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">{tenant.ownerName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="text-sm text-neutral-700">{tenant.phone}</p>
                        <p className="text-xs text-neutral-400">{tenant.email}</p>
                        {tenant.district && (
                          <p className="text-xs text-neutral-400">{tenant.district}</p>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <PlanBadge planId={tenant.planId} />
                      </TableCell>
                      <TableCell className="py-4">
                        {tenant.subscriptionStatus === 'trial' ? (
                          <DaysLeftBadge days={daysLeft} />
                        ) : tenant.subscriptionEndsAt ? (
                          <span className="text-xs text-neutral-500">
                            {t('tenants.expiresAt', {
                              date: tenant.subscriptionEndsAt
                                .toDate()
                                .toLocaleDateString('bn-BD', { month: 'short', day: 'numeric', year: 'numeric' }),
                            })}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <TenantStatusBadge
                          status={tenant.subscriptionStatus}
                          isTrial={tenant.isTrial}
                        />
                      </TableCell>
                      <TableCell className="py-4 pr-4 text-right">
                        <TenantActionsMenu
                          tenant={tenant}
                          onActivate={(t) => setActivateTenant(t)}
                          onEdit={(t) => setEditTenant(t)}
                          onSuspend={(t) => setSuspendTarget(t)}
                          onReactivate={(t) => setReactivateTarget(t)}
                          onDelete={(t) => setDeleteTarget(t)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modals */}
      <CreateTenantModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={() => {}}
        adminId={user?.uid ?? ''}
      />

      <ActivateTenantModal
        open={!!activateTenant}
        onOpenChange={(open) => { if (!open) setActivateTenant(null); }}
        tenant={activateTenant}
        onSuccess={() => {}}
        adminId={user?.uid ?? ''}
        adminEmail={user?.email ?? ''}
      />

      <EditTenantModal
        open={!!editTenant}
        onOpenChange={(open) => { if (!open) setEditTenant(null); }}
        tenant={editTenant}
        onSuccess={() => {}}
        adminId={user?.uid ?? ''}
      />

      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}
        title={t('suspend.confirmTitle')}
        description={t('suspend.confirmMessage')}
        confirmLabel={t('suspend.confirm')}
        cancelLabel={t('suspend.cancel')}
        onConfirm={handleSuspend}
        destructive
        loading={suspendLoading}
      />

      <ConfirmDialog
        open={!!reactivateTarget}
        onOpenChange={(open) => { if (!open) setReactivateTarget(null); }}
        title={t('suspend.reactivateTitle')}
        description={t('suspend.reactivateMessage')}
        confirmLabel={t('suspend.reactivateConfirm')}
        cancelLabel={t('suspend.cancel')}
        onConfirm={handleReactivate}
        loading={suspendLoading}
      />

      <DeleteTenantModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        tenant={deleteTarget}
        onSuccess={() => {}}
      />
    </div>
  );
}
