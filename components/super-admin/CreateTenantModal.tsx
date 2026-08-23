'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTenantSchema, type CreateTenantSchema } from '@/lib/validations/tenant';
import { BANGLADESH_DISTRICTS, type PlanId } from '@/lib/types/tenant';
import { useIdToken } from '@/lib/hooks/useIdToken';
import { getSubscriptionPlansOnce } from '@/lib/firebase/subscription-plans';
import type { SubscriptionPlanCatalogEntry } from '@/lib/types/subscription-plan';
import { formatTaka } from '@/lib/utils/calculations';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  adminId: string;
}

export function CreateTenantModal({
  open,
  onOpenChange,
  onSuccess,
  adminId,
}: CreateTenantModalProps) {
  const t = useTranslations('sa');
  const [loading, setLoading] = useState(false);
  const { getToken } = useIdToken();

  // Live pricing (Super Admin's EditPlanModal price edits), same fix as
  // ActivateTenantModal/EditTenantModal (audit #9) applied here — replaces
  // hardcoded, locale-fixed, potentially-stale "৳৯৯৯/মাস" style strings.
  const [livePlans, setLivePlans] = useState<Record<PlanId, SubscriptionPlanCatalogEntry> | null>(null);

  useEffect(() => {
    if (!open) return;
    getSubscriptionPlansOnce()
      .then((plans) => {
        const byId = {} as Record<PlanId, SubscriptionPlanCatalogEntry>;
        for (const p of plans) byId[p.id] = p;
        setLivePlans(byId);
      })
      .catch(() => setLivePlans(null));
  }, [open]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<CreateTenantSchema>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      planId: 'basic',
      // AUDIT-REPORT-5 Issue #3 fix (৪ আগস্ট ২০২৬): default changed from
      // 'PP' to 'PP-' so Super-Admin-created tenants get the same
      // blueprint-documented "PP-2026-0001" order-number format as the
      // self-signup path (app/api/auth/signup/route.ts). Super Admin can
      // still overwrite this field with any prefix before submitting.
      orderIdPrefix: 'PP-',
      district: '',
    },
  });

  const getError = (key: keyof CreateTenantSchema) => {
    const msg = errors[key]?.message;
    if (!msg) return null;
    const tKey = `errors.${msg}` as const;
    try {
      return t(tKey as Parameters<typeof t>[0]);
    } catch {
      return msg;
    }
  };

  const onSubmit = async (data: CreateTenantSchema) => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/super-admin/create-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data, createdByAdminId: adminId }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? 'unknown');
      }
      toast.success(t('createTenant.success'));
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errors.unknown');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'h-10 w-full border border-neutral-200 rounded-lg px-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors';
  const errorClass = 'text-xs text-red-500 mt-1';
  const labelClass = 'text-sm font-medium mb-1 block text-neutral-700';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" preventOutsideClose>
        <DialogHeader>
          <DialogTitle>{t('createTenant.title')}</DialogTitle>
          <DialogDescription>{t('createTenant.subtitle')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Row 1: Name + Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.name')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('name')}
                placeholder={t('createTenant.placeholders.name')}
                className={`${fieldClass} ${errors.name ? 'border-red-400' : ''}`}
              />
              {getError('name') && <p className={errorClass}>{getError('name')}</p>}
            </div>
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.ownerName')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('ownerName')}
                placeholder={t('createTenant.placeholders.ownerName')}
                className={`${fieldClass} ${errors.ownerName ? 'border-red-400' : ''}`}
              />
              {getError('ownerName') && <p className={errorClass}>{getError('ownerName')}</p>}
            </div>
          </div>

          {/* Row 2: Email + Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.email')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('email')}
                type="email"
                placeholder={t('createTenant.placeholders.email')}
                className={`${fieldClass} ${errors.email ? 'border-red-400' : ''}`}
              />
              {getError('email') && <p className={errorClass}>{getError('email')}</p>}
            </div>
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.password')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('password')}
                type="password"
                placeholder={t('createTenant.placeholders.password')}
                className={`${fieldClass} ${errors.password ? 'border-red-400' : ''}`}
              />
              {getError('password') && <p className={errorClass}>{getError('password')}</p>}
            </div>
          </div>

          {/* Row 3: Phone + District */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.phone')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('phone')}
                placeholder={t('createTenant.placeholders.phone')}
                className={`${fieldClass} ${errors.phone ? 'border-red-400' : ''}`}
              />
              {getError('phone') && <p className={errorClass}>{getError('phone')}</p>}
            </div>
            <div>
              <Label className={labelClass}>{t('createTenant.fields.district')}</Label>
              <Select
                onValueChange={(v) => setValue('district', v)}
                defaultValue=""
              >
                <SelectTrigger className="h-10 border-neutral-200">
                  <SelectValue placeholder={t('createTenant.placeholders.district')} />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {BANGLADESH_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Plan + Prefix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.planId')} <span className="text-red-500">*</span>
              </Label>
              <Select
                onValueChange={(v) => setValue('planId', v as 'basic' | 'standard' | 'premium')}
                defaultValue="basic"
              >
                <SelectTrigger className="h-10 border-neutral-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    {t('tenants.plan.basic')}
                    {livePlans?.basic && <> — {formatTaka(livePlans.basic.monthlyPrice)}/{t('createTenant.perMonth')}</>}
                  </SelectItem>
                  <SelectItem value="standard">
                    {t('tenants.plan.standard')}
                    {livePlans?.standard && <> — {formatTaka(livePlans.standard.monthlyPrice)}/{t('createTenant.perMonth')}</>}
                  </SelectItem>
                  <SelectItem value="premium">
                    {t('tenants.plan.premium')}
                    {livePlans?.premium && <> — {formatTaka(livePlans.premium.monthlyPrice)}/{t('createTenant.perMonth')}</>}
                  </SelectItem>
                </SelectContent>
              </Select>
              {getError('planId') && <p className={errorClass}>{getError('planId')}</p>}
            </div>
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.orderIdPrefix')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('orderIdPrefix')}
                placeholder={t('createTenant.placeholders.orderIdPrefix')}
                className={`${fieldClass} ${errors.orderIdPrefix ? 'border-red-400' : ''} uppercase`}
                style={{ textTransform: 'uppercase' }}
              />
              {getError('orderIdPrefix') && (
                <p className={errorClass}>{getError('orderIdPrefix')}</p>
              )}
            </div>
          </div>

          {/* Row 5: Start Date + End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.subscriptionStartedAt')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('subscriptionStartedAt')}
                type="date"
                className={`${fieldClass} ${errors.subscriptionStartedAt ? 'border-red-400' : ''}`}
              />
              {getError('subscriptionStartedAt') && (
                <p className={errorClass}>{getError('subscriptionStartedAt')}</p>
              )}
            </div>
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.subscriptionEndsAt')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('subscriptionEndsAt')}
                type="date"
                className={`${fieldClass} ${errors.subscriptionEndsAt ? 'border-red-400' : ''}`}
              />
              {getError('subscriptionEndsAt') && (
                <p className={errorClass}>{getError('subscriptionEndsAt')}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? t('createTenant.creating') : t('createTenant.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
