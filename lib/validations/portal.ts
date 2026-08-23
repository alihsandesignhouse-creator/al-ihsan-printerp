import { z } from "zod";
import { BD_PHONE_REGEX } from "./auth";

/** Module T-20 (গ্রাহক পোর্টাল) — অর্ডার নম্বর + মোবাইল নম্বর দিয়ে যাচাই। */
export const portalTrackingSchema = z.object({
  orderNumber: z.string().trim().min(1, { message: "validation.required" }),
  phone: z.string().regex(BD_PHONE_REGEX, { message: "validation.bdPhoneInvalid" }),
});

export type PortalTrackingFormValues = z.infer<typeof portalTrackingSchema>;
