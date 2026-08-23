import { z } from "zod";
import { BD_PHONE_REGEX } from "@/lib/validations/auth";

/**
 * lib/validations/platform-settings.ts — SA-05 contact-settings form.
 * Same BD_PHONE_REGEX (01[3-9]XXXXXXXX) used across signup/branch/portal
 * forms, applied here to both the phone and WhatsApp number fields.
 */
export const platformContactSettingsSchema = z.object({
  supportPhone: z
    .string()
    .min(1, { message: "sa.settingsPage.contact.errors.phoneRequired" })
    .regex(BD_PHONE_REGEX, { message: "sa.settingsPage.contact.errors.phoneInvalid" }),
  whatsappPhone: z
    .string()
    .min(1, { message: "sa.settingsPage.contact.errors.phoneRequired" })
    .regex(BD_PHONE_REGEX, { message: "sa.settingsPage.contact.errors.phoneInvalid" }),
  supportEmail: z
    .string()
    .min(1, { message: "sa.settingsPage.contact.errors.emailRequired" })
    .email({ message: "sa.settingsPage.contact.errors.emailInvalid" }),
});

export type PlatformContactSettingsFormValues = z.infer<typeof platformContactSettingsSchema>;
