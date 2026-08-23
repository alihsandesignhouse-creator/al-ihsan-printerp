import { z } from "zod";

// ─── Plan catalog edit (EditPlanModal) ────────────────────────────────────

const planFeaturesSchema = z.object({
  costCalculator: z.boolean(),
  costingManagement: z.boolean(),
  commissionSystem: z.boolean(),
  expenseManagement: z.boolean(),
  quotations: z.boolean(),
  stockManagement: z.boolean(),
  supplierManagement: z.boolean(),
  multiBranch: z.boolean(),
  advancedReports: z.boolean(),
  customBranding: z.boolean(),
  smsNotifications: z.boolean(),
  emailNotifications: z.boolean(),
  whatsappNotifications: z.boolean(),
  dataExport: z.boolean(),
  outsourceTracking: z.boolean(),
  customerPortal: z.boolean(),
  prioritySupport: z.boolean(),
});

export const editPlanSchema = z.object({
  monthlyPrice: z.coerce.number({ invalid_type_error: "required" }).min(0, { message: "min_0" }),
  yearlyPrice: z.coerce.number({ invalid_type_error: "required" }).min(0, { message: "min_0" }),
  /** Empty string in the form = unlimited (null); coerced before submit, not here. */
  maxStaff: z.string(),
  maxBranches: z.string(),
  featuresBn: z.string().min(1, { message: "required" }),
  featuresEn: z.string().min(1, { message: "required" }),
  features: planFeaturesSchema,
});

export type EditPlanSchema = z.infer<typeof editPlanSchema>;

// ─── Coupon create/edit (CouponFormModal) ────────────────────────────────

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, { message: "min_3" })
      .max(20, { message: "max_20" })
      .regex(/^[A-Z0-9-]+$/, { message: "coupon_code_pattern" }),
    discountType: z.enum(["amount", "percent"]),
    discountValue: z.coerce.number({ invalid_type_error: "required" }).positive({ message: "positive" }),
    validFrom: z.string().min(1, { message: "required" }),
    validUntil: z.string().min(1, { message: "required" }),
    /** Empty string = unlimited uses. */
    maxUses: z.string(),
    isActive: z.boolean(),
  })
  .refine((data) => new Date(data.validUntil) > new Date(data.validFrom), {
    message: "end_after_start",
    path: ["validUntil"],
  })
  .refine((data) => data.discountType !== "percent" || data.discountValue <= 100, {
    message: "percent_max_100",
    path: ["discountValue"],
  });

export type CouponFormSchema = z.infer<typeof couponFormSchema>;
