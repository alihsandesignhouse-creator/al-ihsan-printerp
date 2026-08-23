import { z } from "zod";

/**
 * Module T-06 (আইটেম মাস্টার) standalone form schema. Reuses the same
 * validation.itemNameRequired / validation.priceInvalid message keys the
 * inline order-form item rows already use (lib/validations/order.ts →
 * orderItemRowSchema), so no new i18n keys are needed for this module.
 */
const attributeOptionSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1, { message: "validation.optionLabelRequired" }).max(50),
  priceAdjustment: z.number({ invalid_type_error: "validation.priceInvalid" }),
});

const attributeGroupSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, { message: "validation.groupNameRequired" }).max(50),
  options: z.array(attributeOptionSchema).min(1, { message: "itemMaster.groupNeedsOption" }),
});

export const itemMasterFormSchema = z.object({
  name: z.string().trim().min(1, { message: "validation.itemNameRequired" }).max(100),
  defaultUnitPrice: z
    .number({ invalid_type_error: "validation.priceInvalid" })
    .min(0, { message: "validation.priceInvalid" }),
  attributeGroups: z.array(attributeGroupSchema),
});

export type ItemMasterFormValues = z.infer<typeof itemMasterFormSchema>;
