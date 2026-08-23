import { z } from "zod";
import { orderItemRowSchema } from "@/lib/validations/order";

/**
 * "ক্রয় করুন" ফর্মের (দ্বৈত কাস্টমার+সাপ্লায়ার প্রোফাইল, ১৭ আগস্ট ২০২৬)
 * Zod schema। newOrderSchema (lib/validations/order.ts)-এর সাথে ইচ্ছাকৃতভাবে
 * সমান্তরাল রাখা হয়েছে (একই items schema পুনর্ব্যবহার করা হয়েছে, একই
 * discount/adjustment/advance নিয়ম) — কারণ এই ফর্মটা "দেখতে হুবহু একই
 * অর্ডার ফর্মের মতো" হওয়ার কথা, শুধু ডেলিভারি-স্ট্যাটাস/স্টাফ-অ্যাসাইনমেন্ট
 * ছাড়া (দেখুন lib/types/supplier.ts-এর SupplierPurchaseFormInput কমেন্ট)।
 */
export const supplierPurchaseSchema = z
  .object({
    branchId: z.string(),
    items: z.array(orderItemRowSchema).min(1, { message: "validation.atLeastOneItem" }),
    discountType: z.enum(["amount", "percent"]),
    discountValue: z.number().min(0, { message: "validation.discountInvalid" }),
    adjustment: z
      .number()
      .min(-50, { message: "validation.adjustmentRange" })
      .max(50, { message: "validation.adjustmentRange" }),
    advanceAmount: z.number().min(0, { message: "validation.advanceInvalid" }),
    advanceMethod: z.union([
      z.enum(["cash", "bkash", "nagad", "rocket", "bank", "cheque"]),
      z.literal(""),
    ]),
    referenceNumber: z.string().max(100).default(""),
    note: z.string().max(300).default(""),
  })
  .refine((data) => data.discountType !== "percent" || data.discountValue <= 100, {
    message: "validation.discountPercentRange",
    path: ["discountValue"],
  })
  .refine((data) => data.advanceAmount === 0 || data.advanceMethod !== "", {
    message: "validation.advanceMethodRequired",
    path: ["advanceMethod"],
  });

export type SupplierPurchaseSchemaType = z.infer<typeof supplierPurchaseSchema>;
