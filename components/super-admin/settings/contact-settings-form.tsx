"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Phone, MessageCircle, Mail, Upload } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogoMark } from "@/components/shared/brand-logo";
import {
  platformContactSettingsSchema,
  type PlatformContactSettingsFormValues,
} from "@/lib/validations/platform-settings";
import { updatePlatformContactSettings, uploadPlatformLogo } from "@/lib/firebase/platform-settings";
import type { PlatformSettings } from "@/lib/types/platform-settings";

interface ContactSettingsFormProps {
  settings: PlatformSettings;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * components/super-admin/settings/contact-settings-form.tsx — SA-05,
 * "যোগাযোগ সেটিং" tab. Replaces the CONTACT_PHONE/TRIAL_CONTACT_PHONE
 * constants previously hardcoded in four public-facing files (see
 * lib/types/platform-settings.ts's header comment) with a single
 * Super-Admin-editable Firestore document.
 */
export function ContactSettingsForm({ settings }: ContactSettingsFormProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlatformContactSettingsFormValues>({
    resolver: zodResolver(platformContactSettingsSchema),
    defaultValues: {
      supportPhone: settings.supportPhone,
      whatsappPhone: settings.whatsappPhone,
      supportEmail: settings.supportEmail,
    },
  });

  // Live subscription upstream may push another super admin's save while
  // this form is open — resync the (unedited) form defaults, same pattern
  // as GeneralSettingsForm's logoUrl state sync.
  useEffect(() => {
    reset({
      supportPhone: settings.supportPhone,
      whatsappPhone: settings.whatsappPhone,
      supportEmail: settings.supportEmail,
    });
    setLogoUrl(settings.logoUrl);
  }, [settings, reset]);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("sa.settingsPage.contact.logoTypeError"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t("sa.settingsPage.contact.logoSizeError"));
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadPlatformLogo(file);
      setLogoUrl(url);
      toast.success(t("sa.settingsPage.contact.logoSaved"));
    } catch {
      toast.error(t("sa.settingsPage.contact.logoFailed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(values: PlatformContactSettingsFormValues) {
    try {
      await updatePlatformContactSettings(values);
      toast.success(t("sa.settingsPage.contact.saved"));
    } catch {
      toast.error(t("sa.settingsPage.contact.saveFailed"));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">{t("sa.settingsPage.contact.description")}</p>

      <div>
        <Label className="mb-2 block text-sm font-medium text-neutral-700">
          {t("sa.settingsPage.contact.logo")}
        </Label>
        <p className="mb-2 text-xs text-neutral-500">{t("sa.settingsPage.contact.logoHint")}</p>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
            <BrandLogoMark logoUrl={logoUrl} size={64} />
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
              {t("sa.settingsPage.contact.uploadLogo")}
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
            <Phone className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
            {t("sa.settingsPage.contact.phone")}
          </Label>
          <Input {...register("supportPhone")} aria-invalid={!!errors.supportPhone} className="max-w-xs" placeholder="01XXXXXXXXX" />
          {errors.supportPhone && (
            <p className="mt-1 text-xs text-status-danger">{t(errors.supportPhone.message ?? "")}</p>
          )}
        </div>

        <div>
          <Label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
            <MessageCircle className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
            {t("sa.settingsPage.contact.whatsapp")}
          </Label>
          <Input {...register("whatsappPhone")} aria-invalid={!!errors.whatsappPhone} className="max-w-xs" placeholder="01XXXXXXXXX" />
          {errors.whatsappPhone && (
            <p className="mt-1 text-xs text-status-danger">{t(errors.whatsappPhone.message ?? "")}</p>
          )}
          <p className="mt-1 text-xs text-neutral-500">{t("sa.settingsPage.contact.whatsappHint")}</p>
        </div>

        <div>
          <Label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
            <Mail className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
            {t("sa.settingsPage.contact.email")}
          </Label>
          <Input {...register("supportEmail")} aria-invalid={!!errors.supportEmail} className="max-w-xs" />
          {errors.supportEmail && (
            <p className="mt-1 text-xs text-status-danger">{t(errors.supportEmail.message ?? "")}</p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("common.loading") : t("common.save")}
        </Button>
      </form>
    </div>
  );
}
