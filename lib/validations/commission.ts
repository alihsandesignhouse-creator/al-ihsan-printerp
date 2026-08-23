import { z } from "zod";
import { WITHDRAWAL_TYPES } from "@/lib/types/commission";

export const withdrawalRequestSchema = z.object({
  type: z.enum(WITHDRAWAL_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: "validation.required" }),
  }),
  month: z.string().default(""),
  amount: z.coerce
    .number({ invalid_type_error: "validation.amountInvalid" })
    .positive({ message: "validation.amountMustBePositive" }),
  note: z.string().trim().max(300).default(""),
});

export type WithdrawalRequestValues = z.infer<typeof withdrawalRequestSchema>;

export const processWithdrawalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adjustedAmount: z
    .union([z.coerce.number().positive({ message: "validation.amountMustBePositive" }), z.literal("")])
    .optional(),
  adminNote: z.string().trim().max(300).default(""),
});

export type ProcessWithdrawalValues = z.infer<typeof processWithdrawalSchema>;
