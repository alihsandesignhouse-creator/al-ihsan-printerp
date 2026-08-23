import { z } from "zod";

export const changeNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "validation.nameRequired" })
    .min(2, { message: "validation.nameMin" })
    .max(80),
});
export type ChangeNameFormValues = z.infer<typeof changeNameSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: "profile.password.currentRequired" }),
    newPassword: z
      .string()
      .min(1, { message: "profile.password.newRequired" })
      .min(8, { message: "profile.password.newMin" }),
    confirmPassword: z
      .string()
      .min(1, { message: "profile.password.confirmRequired" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "profile.password.mismatch",
    path: ["confirmPassword"],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
