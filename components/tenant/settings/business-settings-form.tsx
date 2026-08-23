"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  businessSettingsSchema,
  type BusinessSettingsFormValues,
} from "@/lib/validations/tenant-settings";
import { updateBusinessSettings } from "@/lib/firebase/tenant-settings";
import type { Tenant } from "@/lib/types/tenant";

interface BusinessSettingsFormProps {
  tenant: Tenant;
}

export function BusinessSettingsForm({ tenant }: BusinessSettingsFormProps) {
  const t = useTranslations();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessSettingsFormValues>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      orderIdPrefix: tenant.orderIdPrefix,
      defaultCommissionRate: tenant.settings.defaultCommissionRate,
      defaultDeliveryDays: tenant.settings.defaultDeliveryDays,
      currency: tenant.settings.currency,
    },
  });

  async function onSubmit(values: BusinessSettingsFormValues) {
    try {
      await updateBusinessSettings(tenant.id, values);
      toast.success(t("settings.business.saved"));
    } catch {
      toast.error(t("settings.business.saveFailed"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">
          {t("settings.business.prefix")}
        </Label>
        <Input
          {...register("orderIdPrefix")}
          aria-invalid={!!errors.orderIdPrefix}
          placeholder="PP-"
          className="max-w-[10rem] uppercase"
        />
        {errors.orderIdPrefix && (
          <p className="mt-1 text-xs text-status-danger">{t(errors.orderIdPrefix.message ?? "")}</p>
        )}
      </div>

      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">
          {t("settings.business.commissionRate")}
        </Label>
        <Input
          type="number"
          step="0.01"
          {...register("defaultCommissionRate", { valueAsNumber: true })}
          aria-invalid={!!errors.defaultCommissionRate}
          className="max-w-[10rem]"
        />
        {errors.defaultCommissionRate && (
          <p className="mt-1 text-xs text-status-danger">
            {t(errors.defaultCommissionRate.message ?? "")}
          </p>
        )}
      </div>

      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">
          {t("settings.business.deliveryDays")}
        </Label>
        <Input
          type="number"
          {...register("defaultDeliveryDays", { valueAsNumber: true })}
          aria-invalid={!!errors.defaultDeliveryDays}
          className="max-w-[10rem]"
        />
        {errors.defaultDeliveryDays && (
          <p className="mt-1 text-xs text-status-danger">
            {t(errors.defaultDeliveryDays.message ?? "")}
          </p>
        )}
      </div>

      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">
          {t("settings.business.currency")}
        </Label>
        <Input {...register("currency")} aria-invalid={!!errors.currency} className="max-w-[10rem]" />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? t("common.loading") : t("common.save")}
      </Button>
    </form>
  );
}
