'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { editTenantSchema, type EditTenantSchema } from '@/lib/validations/tenant';
import { updateTenant } from '@/lib/firebase/tenants';
import type { Tenant, PlanId, PlanFeatures } from '@/lib/types/tenant';
import { BANGLADESH_DISTRICTS, ALL_FEATURE_KEYS, DEFAULT_PLAN_FEATURES } from '@/lib/types/tenant';
import { getSubscriptionPlansOnce } from '@/lib/firebase/subscription-plans';
import { Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface EditTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onSuccess: () => void;
  adminId: string;
}

export function EditTenantModal({
  open,
  onOpenChange,
  tenant,
  onSuccess,
  adminId,
}: EditTenantModalProps) {
  const t = useTranslations('sa');
  const [loading, setLoading] = useState(false);
  // Live per-plan base feature set (Super Admin's EditPlanModal toggles),
  // falling back to the DEFAULT_PLAN_FEATURES code constant for any plan
  // that hasn't been saved to Firestore yet — see planHasFeature() below.
  const [livePlanFeatures, setLivePlanFeatures] = useState<Record<PlanId, PlanFeatures> | null>(null);

  useEffect(() => {
    if (!open) return;
    getSubscriptionPlansOnce()
      .then((plans) => {
        const byId = {} as Record<PlanId, PlanFeatures>;
        for (const p of plans) byId[p.id] = p.features;
        setLivePlanFeatures(byId);
      })
      .catch(() => setLivePlanFeatures(null));
  }, [open]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
    reset,
  } = useForm<EditTenantSchema>({
    resolver: zodResolver(editTenantSchema),
  });

  const watchedPlanId = watch('planId') as PlanId | undefined;

  // Populate form when tenant changes
  useEffect(() => {
    if (!tenant) return;
    const endsAt = tenant.subscriptionEndsAt
      ? tenant.subscriptionEndsAt.toDate().toISOString().split('T')[0]
      : '';
    reset({
      name: tenant.name,
      ownerName: tenant.ownerName,
      phone: tenant.phone,
      district: tenant.district ?? '',
      address: tenant.address ?? '',
      planId: tenant.planId,
      subscriptionEndsAt: endsAt,
      orderIdPrefix: tenant.orderIdPrefix,
      featureOverrides: tenant.featureOverrides ?? {},
    });
  }, [tenant, reset]);

  const onSubmit = async (data: EditTenantSchema) => {
    if (!tenant) return;
    setLoading(true);
    try {
      await updateTenant(tenant.id, {
        name: data.name,
        ownerName: data.ownerName,
        phone: data.phone,
        district: data.district ?? '',
        address: data.address ?? '',
        planId: data.planId,
        subscriptionEndsAt: new Date(data.subscriptionEndsAt),
        orderIdPrefix: data.orderIdPrefix,
        featureOverrides: data.featureOverrides ?? {},
        updatedByAdminId: adminId,
      });
      toast.success(t('editTenant.success'));
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(t('editTenant.error'));
      if (process.env.NODE_ENV === 'development') console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'h-10 w-full border border-neutral-200 rounded-lg px-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors';
  const errorClass = 'text-xs text-red-500 mt-1';
  const labelClass = 'text-sm font-medium mb-1 block text-neutral-700';

  // Determine if a feature key is enabled by plan
  const planHasFeature = (key: keyof PlanFeatures): boolean => {
    if (!watchedPlanId) return false;
    const source = livePlanFeatures?.[watchedPlanId] ?? DEFAULT_PLAN_FEATURES[watchedPlanId];
    return source?.[key] ?? false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" preventOutsideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-primary" />
            {t('editTenant.title')}
          </DialogTitle>
          <DialogDescription>
            {tenant?.name} — {t('editTenant.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Row: Name + Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.name')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('name')}
                className={`${fieldClass} ${errors.name ? 'border-red-400' : ''}`}
              />
              {errors.name && <p className={errorClass}>{t(`errors.${errors.name.message as 'min_2'}`)}</p>}
            </div>
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.ownerName')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('ownerName')}
                className={`${fieldClass} ${errors.ownerName ? 'border-red-400' : ''}`}
              />
              {errors.ownerName && <p className={errorClass}>{t(`errors.${errors.ownerName.message as 'min_2'}`)}</p>}
            </div>
          </div>

          {/* Row: Phone + District */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.phone')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('phone')}
                className={`${fieldClass} ${errors.phone ? 'border-red-400' : ''}`}
              />
              {errors.phone && <p className={errorClass}>{t('errors.valid_bd_phone')}</p>}
            </div>
            <div>
              <Label className={labelClass}>{t('createTenant.fields.district')}</Label>
              <Select
                onValueChange={(v) => setValue('district', v)}
                value={watch('district')}
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

          {/* Address */}
          <div>
            <Label className={labelClass}>{t('tenantDetail.fields.address')}</Label>
            <input
              {...register('address')}
              className={`${fieldClass} ${errors.address ? 'border-red-400' : ''}`}
            />
            {errors.address && <p className={errorClass}>{t(`errors.${errors.address.message as 'max_200'}`)}</p>}
          </div>

          {/* Row: Plan + End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.planId')} <span className="text-red-500">*</span>
              </Label>
              <Select
                onValueChange={(v) => setValue('planId', v as PlanId)}
                value={watch('planId')}
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
            <div>
              <Label className={labelClass}>
                {t('createTenant.fields.subscriptionEndsAt')} <span className="text-red-500">*</span>
              </Label>
              <input
                {...register('subscriptionEndsAt')}
                type="date"
                className={`${fieldClass} ${errors.subscriptionEndsAt ? 'border-red-400' : ''}`}
              />
              {errors.subscriptionEndsAt && (
                <p className={errorClass}>{t(`errors.${errors.subscriptionEndsAt.message as 'required'}`)}</p>
              )}
            </div>
          </div>

          {/* Order ID Prefix */}
          <div className="w-1/2">
            <Label className={labelClass}>
              {t('createTenant.fields.orderIdPrefix')} <span className="text-red-500">*</span>
            </Label>
            <input
              {...register('orderIdPrefix')}
              className={`${fieldClass} ${errors.orderIdPrefix ? 'border-red-400' : ''} uppercase`}
            />
            {errors.orderIdPrefix && (
              <p className={errorClass}>{t('errors.prefix_pattern')}</p>
            )}
          </div>

          {/* Feature Overrides */}
          <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-neutral-800">
                {t('editTenant.featureOverrides')}
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                {t('editTenant.featureOverrideNote')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_FEATURE_KEYS.map((key) => {
                const isPlanIncluded = planHasFeature(key);
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-2 rounded-lg ${isPlanIncluded ? 'bg-green-50' : 'bg-neutral-50'}`}
                  >
                    <div>
                      <p className="text-xs font-medium text-neutral-700">
                        {t(`features.${key}`)}
                      </p>
                      {isPlanIncluded && (
                        <p className="text-[10px] text-green-600">{t('editTenant.includedInPlan')}</p>
                      )}
                    </div>
                    <Controller
                      name={`featureOverrides.${key}`}
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={isPlanIncluded || (field.value ?? false)}
                          onCheckedChange={isPlanIncluded ? undefined : field.onChange}
                          disabled={isPlanIncluded}
                          className={isPlanIncluded ? 'opacity-60' : ''}
                        />
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
              {loading ? t('editTenant.saving') : t('editTenant.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
