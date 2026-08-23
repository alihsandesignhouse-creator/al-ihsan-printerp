import { z } from "zod";
import { ZAKAT_CATEGORIES } from "@/lib/types/zakat";

export const zakatYearStartSchema = z
  .object({
    hijriYear: z.string().trim().min(1, { message: "validation.required" }).max(20),
    hawlStart: z.string().min(1, { message: "validation.required" }),
    hawlEnd: z.string().min(1, { message: "validation.required" }),
  })
  .refine((data) => new Date(data.hawlEnd) > new Date(data.hawlStart), {
    message: "zakat.hawlEndBeforeStart",
    path: ["hawlEnd"],
  });

export type ZakatYearStartValues = z.infer<typeof zakatYearStartSchema>;

export const zakatPaymentSchema = z.object({
  date: z.string().min(1, { message: "validation.required" }),
  amount: z.coerce
    .number({ invalid_type_error: "validation.amountInvalid" })
    .positive({ message: "validation.amountMustBePositive" }),
  method: z.string().trim().min(1, { message: "validation.required" }).max(60),
  category: z.enum(ZAKAT_CATEGORIES, {
    errorMap: () => ({ message: "validation.required" }),
  }),
  recipientName: z.string().trim().max(120).default(""),
  notes: z.string().trim().max(300).default(""),
});

export type ZakatPaymentValues = z.infer<typeof zakatPaymentSchema>;
