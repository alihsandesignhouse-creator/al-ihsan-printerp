"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, MessageSquare, Mail } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  notificationSettingsSchema,
  type NotificationSettingsFormValues,
} from "@/lib/validations/tenant-settings";
import { updateNotificationTemplates } from "@/lib/firebase/tenant-settings";
import type { Tenant } from "@/lib/types/tenant";

interface NotificationSettingsFormProps {
  tenant: Tenant;
}

const TEMPLATE_KEYS = ["orderConfirmation", "deliveryReminder", "paymentReceived", "dueReminder"] as const;

export function NotificationSettingsForm({ tenant }: NotificationSettingsFormProps) {
  const t = useTranslations();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<NotificationSettingsFormValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: tenant.notificationTemplates,
  });

  async function onSubmit(values: NotificationSettingsFormValues) {
    try {
      await updateNotificationTemplates(tenant.id, values);
      toast.success(t("settings.notification.saved"));
    } catch {
      toast.error(t("settings.notification.saveFailed"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <p className="text-xs text-neutral-500">{t("settings.notification.placeholderHint")}</p>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <MessageSquare className="h-4 w-4" /> {t("settings.notification.smsSection")}
        </h3>
        <div className="space-y-4">
          {TEMPLATE_KEYS.map((key) => (
            <div key={`sms-${key}`}>
              <Label className="mb-1 block text-sm font-medium text-neutral-700">
                {t(`settings.notification.templates.${key}`)}
              </Label>
              <Textarea {...register(`sms.${key}`)} rows={2} className="max-w-xl" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Mail className="h-4 w-4" /> {t("settings.notification.emailSection")}
        </h3>
        <div className="space-y-4">
          {TEMPLATE_KEYS.map((key) => (
            <div key={`email-${key}`}>
              <Label className="mb-1 block text-sm font-medium text-neutral-700">
                {t(`settings.notification.templates.${key}`)}
              </Label>
              <Textarea {...register(`email.${key}`)} rows={2} className="max-w-xl" />
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? t("common.loading") : t("common.save")}
      </Button>
    </form>
  );
}
