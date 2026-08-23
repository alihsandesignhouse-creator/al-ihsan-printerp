import { z } from "zod";
import { selectedAttributeSchema } from "./order";

export const quotationItemRowSchema = z.object({
  rowId: z.string(),
  itemName: z.string().trim().min(1, { message: "validation.itemNameRequired" }).max(100),
  description: z.string().max(200).default(""),
  quantity: z.number({ invalid_type_error: "validation.quantityInvalid" }).positive({ message: "validation.quantityInvalid" }),
  unitPrice: z.number({ invalid_type_error: "validation.priceInvalid" }).min(0, { message: "validation.priceInvalid" }),
  // ৩০ জুলাই ২০২৬ ফিচার — see order.ts's orderItemRowSchema's identical field.
  totalOverride: z.number().min(0).nullable().default(null),
  // Item Variants ধাপ ২ (১২ আগস্ট ২০২৬) — order.ts-এর orderItemRowSchema-র
  // identical কারণে (bare z.object() strips unrecognized keys)।
  selectedAttributes: z.array(selectedAttributeSchema).default([]),
});

export const newQuotationSchema = z
  .object({
    // বাগ-ফিক্স (১৫ আগস্ট ২০২৬, শূন্য-শাখা / একক-মালিক): order.ts-এর
    // newOrderSchema-র identical কারণে — .min(1) বাদ দিয়ে branchId
    // conditional-required চেক এখন quotation-form.tsx-এর onSubmit-এ হয়।
    branchId: z.string(),
    customerId: z.string().nullable(),
    recipientName: z.string().trim().max(100).default(""),
    recipientPhone: z.string().max(20).default(""),
    recipientCompany: z.string().max(100).default(""),
    items: z.array(quotationItemRowSchema).min(1, { message: "validation.atLeastOneItem" }),
    validUntil: z.string().min(1, { message: "validation.validUntilRequired" }),
    terms: z.string().max(1000).default(""),
    notes: z.string().max(500).default(""),
  })
  // একজন প্রাপক অবশ্যই থাকতে হবে — বিদ্যমান কাস্টমার নির্বাচিত অথবা অন্তত
  // একটি recipientName টাইপ করা (এখনো সিস্টেমে নেই এমন সম্ভাব্য গ্রাহক)।
  .refine((data) => data.customerId !== null || data.recipientName.trim().length > 0, {
    message: "validation.recipientRequired",
    path: ["recipientName"],
  });

export type NewQuotationSchemaType = z.infer<typeof newQuotationSchema>;

export const quotationStatusChangeSchema = z.object({
  quotationId: z.string().min(1),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
});
