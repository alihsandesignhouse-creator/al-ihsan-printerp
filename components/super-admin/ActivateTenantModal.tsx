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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { activateTenantSchema, type ActivateTenantSchema } from '@/lib/validations/tenant';
import { activateTenant, addDuration } from '@/lib/firebase/tenants';
import { getSubscriptionPlansOnce } from '@/lib/firebase/subscription-plans';
import type { SubscriptionPlanCatalogEntry } from '@/lib/types/subscription-plan';
import type { Tenant, PlanId } from '@/lib/types/tenant';
import { formatTaka } from '@/lib/utils/calculations';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ActivateTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onSuccess: () => void;
  adminId: string;
  /** বাগ-ফিক্স (১৮ আগস্ট ২০২৬ লাইভ-অডিট): "Activated By" রিডেবল ইমেইল দেখানোর জন্য। */
  adminEmail: string;
}

export function ActivateTenantModal({
  open,
  onOpenChange,
  tenant,
  onSuccess,
  adminId,
  adminEmail,
}: ActivateTenantModalProps) {
  const t = useTranslations('sa');
  const [loading, setLoading] = useState(false);
  // Live pricing (Super Admin's EditPlanModal price edits) fetched once
  // per modal open — replaces the old hardcoded planPrices constant so
  // "তালিকা মূল্য" genuinely reflects the current catalog, same offline
  // reasoning as EditTenantModal's livePlanFeatures fetch (audit #9).
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
    watch,
    formState: { errors },
    reset,
  } = useForm<ActivateTenantSchema>({
    resolver: zodResolver(activateTenantSchema),
    defaultValues: {
      planId: 'standard',
      duration: '1m',
      discountType: 'amount',
      discountValue: 0,
      paymentNotes: '',
    },
  });

  const watchedPlan = watch('planId');
  const watchedDuration = watch('duration');
  const watchedDiscountType = watch('discountType');
  const watchedDiscountValue = watch('discountValue');

  const previewEndsAt =
    watchedDuration
      ? addDuration(new Date(), watchedDuration as '1m' | '3m' | '6m' | '12m')
      : null;

  const listPriceFor = (planId: PlanId, duration: '1m' | '3m' | '6m' | '12m'): number => {
    const plan = livePlans?.[planId];
    if (!plan) return 0;
    if (duration === '12m') return plan.yearlyPrice;
    return plan.monthlyPrice * Number(duration.replace('m', ''));
  };

  const listPrice = watchedPlan && watchedDuration ? listPriceFor(watchedPlan, watchedDuration as '1m' | '3m' | '6m' | '12m') : 0;
  const discountValueNum = Number(watchedDiscountValue) || 0;
  const discountAmount =
    watchedDiscountType === 'percent'
      ? Math.round((listPrice * Math.min(discountValueNum, 100)) / 100)
      : Math.min(discountValueNum, listPrice);
  const amountReceived = Math.max(0, listPrice - discountAmount);

  const onSubmit = async (data: ActivateTenantSchema) => {
    if (!tenant) return;
    setLoading(true);
    try {
      await activateTenant({
        tenantId: tenant.id,
        planId: data.planId,
        duration: data.duration as '1m' | '3m' | '6m' | '12m',
        discountType: data.discountType,
        discountValue: data.discountValue,
        paymentNotes: data.paymentNotes ?? '',
        activatedByAdminId: adminId,
        activatedByAdminEmail: adminEmail,
      });
      toast.success(t('activateTenant.success'));
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(t('activateTenant.error'));
      if (process.env.NODE_ENV === 'development') console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const labelClass = 'text-sm font-medium mb-1 block text-neutral-700';
  const errorClass = 'text-xs text-red-500 mt-1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" preventOutsideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            {t('activateTenant.title')}
          </DialogTitle>
          <DialogDescription>
            {tenant?.name} — {t('activateTenant.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Tenant info summary */}
          <div className="bg-neutral-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">{t('tenantDetail.fields.pressName')}</span>
              <span className="font-medium">{tenant?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{t('tenantDetail.fields.ownerName')}</span>
              <span>{tenant?.ownerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{t('tenantDetail.fields.phone')}</span>
              <span>{tenant?.phone}</span>
            </div>
          </div>

          {/* Package */}
          <div>
            <Label className={labelClass}>
              {t('activateTenant.fields.planId')} <span className="text-red-500">*</span>
            </Label>
            <Select
              onValueChange={(v) => setValue('planId', v as 'basic' | 'standard' | 'premium')}
              defaultValue="standard"
            >
              <SelectTrigger className="h-10 border-neutral-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">{t('tenants.plan.basic')}</SelectItem>
                <SelectItem value="standard">{t('tenants.plan.standard')}</SelectItem>
                <SelectItem value="premium">{t('tenants.plan.premium')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div>
            <Label className={labelClass}>
              {t('activateTenant.fields.duration')} <span className="text-red-500">*</span>
            </Label>
            <Select
              onValueChange={(v) => setValue('duration', v as '1m' | '3m' | '6m' | '12m')}
              defaultValue="1m"
            >
              <SelectTrigger className="h-10 border-neutral-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['1m', '3m', '6m', '12m'] as const).map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`activateTenant.duration.${d}`)}
                    {watchedPlan && (
                      <span className="text-neutral-500 ml-2">
                        — {formatTaka(listPriceFor(watchedPlan, d))}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {previewEndsAt && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
              <span className="text-blue-700 font-medium">
                মেয়াদ শেষ হবে:{' '}
                {previewEndsAt.toLocaleDateString('bn-BD', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Discount / payment breakdown */}
          <div className="border border-neutral-200 rounded-lg p-3 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">{t('activateTenant.fields.listPrice')}</span>
              <span className="font-medium">{formatTaka(listPrice)}</span>
            </div>

            {/* বাগ-ফিক্স (২১ আগস্ট ২০২৬, সুপার-অ্যাডমিন মোবাইল অডিট): sm: প্রিফিক্স যোগ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className={labelClass}>{t('activateTenant.fields.discountType')}</Label>
                <Select
                  onValueChange={(v) => setValue('discountType', v as 'amount' | 'percent')}
                  defaultValue="amount"
                >
                  <SelectTrigger className="h-10 border-neutral-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">{t('activateTenant.discountType.amount')}</SelectItem>
                    <SelectItem value="percent">{t('activateTenant.discountType.percent')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelClass}>{t('activateTenant.fields.discountValue')}</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  {...register('discountValue')}
                  className="h-10 border-neutral-200"
                />
                {errors.discountValue && (
                  <p className={errorClass}>{errors.discountValue.message}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-neutral-400">{t('activateTenant.freeActivationNote')}</p>

            <div className="flex justify-between text-sm border-t border-neutral-100 pt-3">
              <span className="font-medium text-neutral-700">
                {t('activateTenant.fields.amountReceived')}
              </span>
              <span className="font-semibold text-green-700">{formatTaka(amountReceived)}</span>
            </div>
          </div>

          {/* Payment Notes */}
          <div>
            <Label className={labelClass}>{t('activateTenant.fields.paymentNotes')}</Label>
            <Textarea
              {...register('paymentNotes')}
              placeholder={t('activateTenant.placeholders.paymentNotes')}
              rows={2}
              className="border-neutral-200 text-sm resize-none"
            />
            {errors.paymentNotes && (
              <p className={errorClass}>{errors.paymentNotes.message}</p>
            )}
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
              className="bg-status-success hover:bg-status-success/90 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? t('activateTenant.activating') : t('activateTenant.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
