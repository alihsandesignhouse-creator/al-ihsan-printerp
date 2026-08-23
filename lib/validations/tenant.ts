import { z } from 'zod';

// Bangladeshi phone regex from blueprint
const bdPhone = z
  .string()
  .regex(/^01[3-9]\d{8}$/, { message: 'valid_bd_phone' });

const planIdEnum = z.enum(['basic', 'standard', 'premium']);
const durationEnum = z.enum(['1m', '3m', '6m', '12m']);

// ─── Create Tenant (Admin Created) ────────────────────────────────────────

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'min_2' })
    .max(100, { message: 'max_100' }),
  ownerName: z
    .string()
    .trim()
    .min(2, { message: 'min_2' })
    .max(80, { message: 'max_80' }),
  email: z
    .string()
    .email({ message: 'invalid_email' }),
  password: z
    .string()
    .min(8, { message: 'min_8' }),
  phone: bdPhone,
  district: z.string().optional(),
  planId: planIdEnum,
  subscriptionStartedAt: z
    .string()
    .min(1, { message: 'required' }),
  subscriptionEndsAt: z
    .string()
    .min(1, { message: 'required' }),
  orderIdPrefix: z
    .string()
    .min(1, { message: 'min_1' })
    .max(6, { message: 'max_6' })
    .regex(/^[A-Z0-9-]+$/, { message: 'prefix_pattern' }),
}).refine(
  (data) => new Date(data.subscriptionEndsAt) > new Date(data.subscriptionStartedAt),
  { message: 'end_after_start', path: ['subscriptionEndsAt'] },
);

export type CreateTenantSchema = z.infer<typeof createTenantSchema>;

// ─── Activate Tenant (Trial → Paid) ──────────────────────────────────────

export const activateTenantSchema = z.object({
  planId: planIdEnum,
  duration: durationEnum,
  discountType: z.enum(['amount', 'percent']).default('amount'),
  /** টাকা হলে সরাসরি টাকার অংক, % হলে ০-১০০ (১০০ = সম্পূর্ণ ফ্রি activation) */
  discountValue: z.coerce
    .number({ invalid_type_error: 'required' })
    .min(0, { message: 'min_0' })
    .default(0),
  paymentNotes: z
    .string()
    .max(500, { message: 'max_500' })
    .optional(),
}).refine(
  (data) => data.discountType !== 'percent' || data.discountValue <= 100,
  { message: 'max_100_percent', path: ['discountValue'] },
);

export type ActivateTenantSchema = z.infer<typeof activateTenantSchema>;

// ─── Edit Tenant ──────────────────────────────────────────────────────────

export const editTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'min_2' })
    .max(100, { message: 'max_100' }),
  ownerName: z
    .string()
    .trim()
    .min(2, { message: 'min_2' })
    .max(80, { message: 'max_80' }),
  phone: bdPhone,
  district: z.string().optional(),
  address: z.string().trim().max(200, { message: 'max_200' }).optional(),
  planId: planIdEnum,
  subscriptionEndsAt: z.string().min(1, { message: 'required' }),
  orderIdPrefix: z
    .string()
    .min(1, { message: 'min_1' })
    .max(6, { message: 'max_6' })
    .regex(/^[A-Z0-9-]+$/, { message: 'prefix_pattern' }),
  featureOverrides: z
    .object({
      costCalculator: z.boolean().optional(),
      costingManagement: z.boolean().optional(),
      commissionSystem: z.boolean().optional(),
      expenseManagement: z.boolean().optional(),
      quotations: z.boolean().optional(),
      stockManagement: z.boolean().optional(),
      supplierManagement: z.boolean().optional(),
      multiBranch: z.boolean().optional(),
      advancedReports: z.boolean().optional(),
      customBranding: z.boolean().optional(),
      smsNotifications: z.boolean().optional(),
      emailNotifications: z.boolean().optional(),
      whatsappNotifications: z.boolean().optional(),
      dataExport: z.boolean().optional(),
      outsourceTracking: z.boolean().optional(),
      customerPortal: z.boolean().optional(),
      prioritySupport: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

export type EditTenantSchema = z.infer<typeof editTenantSchema>;
