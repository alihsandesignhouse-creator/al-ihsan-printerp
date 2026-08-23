import { z } from "zod";

/** Bangladeshi mobile number: 01[3-9]XXXXXXXX (11 digits total) */
export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

export const signupSchema = z.object({
  pressName: z
    .string()
    .trim()
    .min(1, { message: "signup.pressNameRequired" })
    .min(2, { message: "signup.pressNameMin" })
    .max(120),
  ownerName: z
    .string()
    .trim()
    .min(1, { message: "signup.ownerNameRequired" })
    .min(2, { message: "signup.ownerNameMin" })
    .max(120),
  email: z
    .string()
    .min(1, { message: "signup.emailRequired" })
    .email({ message: "signup.emailInvalid" }),
  password: z
    .string()
    .min(1, { message: "signup.passwordRequired" })
    .min(8, { message: "signup.passwordMin" }),
  phone: z
    .string()
    .min(1, { message: "signup.phoneRequired" })
    .regex(BD_PHONE_REGEX, { message: "signup.phoneInvalid" }),
  district: z.string().max(60).optional().or(z.literal("")),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "auth.emailRequired" })
    .email({ message: "auth.emailInvalid" }),
  password: z.string().min(1, { message: "auth.passwordRequired" }),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: "auth.emailRequired" })
    .email({ message: "auth.emailInvalid" }),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
