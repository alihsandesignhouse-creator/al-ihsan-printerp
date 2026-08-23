import { z } from "zod";
import { BD_PHONE_REGEX } from "@/lib/validations/auth";

export const branchFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "validation.nameRequired" })
    .min(2, { message: "validation.nameMin" })
    .max(100),
  address: z
    .string()
    .trim()
    .min(1, { message: "validation.addressRequired" })
    .max(300),
  phone: z
    .string()
    .max(11)
    .refine((v) => v === "" || BD_PHONE_REGEX.test(v), {
      message: "validation.bdPhoneInvalid",
    })
    .default(""),
  branchManagerId: z.string().default(""),
  isActive: z.boolean().default(true),
});

export type BranchFormValues = z.infer<typeof branchFormSchema>;
