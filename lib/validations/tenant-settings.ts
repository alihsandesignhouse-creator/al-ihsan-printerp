import { z } from "zod";

export const generalSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "validation.nameRequired" })
    .min(2, { message: "validation.nameMin" })
    .max(120),
  address: z.string().trim().max(300).default(""),
  invoiceFooterMessage: z.string().trim().max(300).default(""),
});
export type GeneralSettingsFormValues = z.infer<typeof generalSettingsSchema>;

export const businessSettingsSchema = z.object({
  orderIdPrefix: z
    .string()
    .min(1, { message: "settings.business.prefixRequired" })
    .max(6, { message: "settings.business.prefixMax" })
    .regex(/^[A-Z0-9-]+$/, { message: "settings.business.prefixFormat" }),
  defaultCommissionRate: z
    .number({ invalid_type_error: "validation.commissionInvalid" })
    .min(0, { message: "validation.commissionInvalid" })
    .max(100, { message: "validation.commissionInvalid" }),
  defaultDeliveryDays: z
    .number({ invalid_type_error: "settings.business.deliveryDaysInvalid" })
    .int()
    .min(0, { message: "settings.business.deliveryDaysInvalid" })
    .max(365, { message: "settings.business.deliveryDaysInvalid" }),
  currency: z
    .string()
    .min(1, { message: "settings.business.currencyRequired" })
    .max(6),
});
export type BusinessSettingsFormValues = z.infer<typeof businessSettingsSchema>;

const templateChannelSchema = z.object({
  orderConfirmation: z.string().max(500),
  deliveryReminder: z.string().max(500),
  paymentReceived: z.string().max(500),
  dueReminder: z.string().max(500),
});

export const notificationSettingsSchema = z.object({
  sms: templateChannelSchema,
  email: templateChannelSchema,
});
export type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;
