"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Upload, Building2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { generalSettingsSchema, type GeneralSettingsFormValues } from "@/lib/validations/tenant-settings";
import { updateGeneralSettings, uploadTenantLogo } from "@/lib/firebase/tenant-settings";
import type { Tenant } from "@/lib/types/tenant";

interface GeneralSettingsFormProps {
  tenant: Tenant;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function GeneralSettingsForm({ tenant }: GeneralSettingsFormProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      name: tenant.name,
      address: tenant.address,
      invoiceFooterMessage: tenant.invoiceFooterMessage ?? "",
    },
  });

  async function onSubmit(values: GeneralSettingsFormValues) {
    try {
      await updateGeneralSettings(tenant.id, values);
      toast.success(t("settings.general.saved"));
    } catch {
      toast.error(t("settings.general.saveFailed"));
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.general.logoTypeError"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t("settings.general.logoSizeError"));
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadTenantLogo(tenant.id, file);
      setLogoUrl(url);
      toast.success(t("settings.general.logoSaved"));
    } catch {
      toast.error(t("settings.general.logoFailed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block text-sm font-medium text-neutral-700">
          {t("settings.general.logo")}
        </Label>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {logoUrl ? (
              <Image src={logoUrl} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />
            ) : (
              <Building2 className="h-7 w-7 text-neutral-300" />
            )}
          </span>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              {t("settings.general.uploadLogo")}
            </Button>
            <p className="mt-1 text-xs text-neutral-500">{t("settings.general.logoHint")}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label className="mb-1 block text-sm font-medium text-neutral-700">
            {t("settings.general.pressName")}
          </Label>
          <Input {...register("name")} aria-invalid={!!errors.name} className="max-w-md" />
          {errors.name && (
            <p className="mt-1 text-xs text-status-danger">{t(errors.name.message ?? "")}</p>
          )}
        </div>

        <div>
          <Label className="mb-1 block text-sm font-medium text-neutral-700">
            {t("settings.general.address")}
          </Label>
          <Textarea {...register("address")} rows={2} className="max-w-md" />
        </div>

        <div>
          <Label className="mb-1 block text-sm font-medium text-neutral-700">
            {t("settings.general.invoiceFooter")}
          </Label>
          <Textarea {...register("invoiceFooterMessage")} rows={2} className="max-w-md" />
          <p className="mt-1 text-xs text-neutral-500">{t("settings.general.invoiceFooterHint")}</p>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("common.loading") : t("common.save")}
        </Button>
      </form>
    </div>
  );
}
