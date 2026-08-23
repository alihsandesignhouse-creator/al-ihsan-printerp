import { z } from "zod";

export const costCategoryNameSchema = z
  .string()
  .trim()
  .min(1, { message: "validation.categoryNameRequired" })
  .max(60, { message: "validation.categoryNameTooLong" });

/** Shared by both the "টেমপ্লেট সেভ" and "হিসাব সংরক্ষণ" naming dialogs. */
export const saveAsNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "validation.nameRequired" })
    .max(120, { message: "validation.nameTooLong" }),
});

export type SaveAsNameValues = z.infer<typeof saveAsNameSchema>;
