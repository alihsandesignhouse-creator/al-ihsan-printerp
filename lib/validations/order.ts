import { z } from "zod";

const bdPhone = z
  .string()
  .regex(/^01[3-9]\d{8}$/, { message: "validation.bdPhoneInvalid" });

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, { message: "validation.nameRequired" }).max(80),
  phone: bdPhone,
  email: z.union([z.string().email({ message: "validation.emailInvalid" }), z.literal("")]),
  address: z.string().max(200).default(""),
  companyName: z.string().max(100).default(""),
});

export const selectedAttributeSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  optionId: z.string(),
  optionLabel: z.string(),
  priceAdjustment: z.number(),
});

export const orderItemRowSchema = z.object({
  rowId: z.string(),
  itemName: z.string().trim().min(1, { message: "validation.itemNameRequired" }).max(100),
  description: z.string().max(200).default(""),
  quantity: z.number({ invalid_type_error: "validation.quantityInvalid" }).positive({ message: "validation.quantityInvalid" }),
  unitPrice: z.number({ invalid_type_error: "validation.priceInvalid" }).min(0, { message: "validation.priceInvalid" }),
  // ৩০ জুলাই ২০২৬ ফিচার — non-null when the user typed the line TOTAL
  // directly instead of the per-piece price; see
  // lib/utils/calculations.ts's calcEffectiveLineTotal().
  totalOverride: z.number().min(0).nullable().default(null),
  addToItemMaster: z.boolean().default(false),
  // audit #৪, ধাপ ২ — bare z.object() strips unrecognized keys by default,
  // তাই এই ফিল্ড schema-তে না থাকলে zodResolver validation-এর পর
  // selectedAttributes নিঃশব্দে হারিয়ে যেত।
  selectedAttributes: z.array(selectedAttributeSchema).default([]),
});

export const newOrderSchema = z
  .object({
    // বাগ-ফিক্স (১৫ আগস্ট ২০২৬, শূন্য-শাখা / একক-মালিক): আগে এখানে
    // .min(1) ছিল, অর্থাৎ branchId স্কিমাতে সবসময় বাধ্যতামূলক। কিন্তু
    // ইতিমধ্যে-বিদ্যমান কোনো টেন্যান্টের যদি (এই বাগের শিকার হয়ে) এখনো
    // কোনো শাখা না থাকে, তাহলে branchId পূরণ করার কোনো উপায়ই ব্যবহারকারীর
    // কাছে ছিল না, ফলে zodResolver নিঃশব্দে ভ্যালিডেশন আটকে দিত। এখন
    // branchId শুধু একটা string (খালিও হতে পারে) — আসল required-check
    // এখন order-form.tsx-এর onSubmit-এ expense-form-dialog.tsx-এর মতোই
    // "branches.length > 0 হলে তবেই required" শর্তসাপেক্ষে হয়, যাতে
    // শূন্য-শাখা অবস্থায়ও ফর্ম কখনো স্থায়ীভাবে আটকে না থাকে।
    branchId: z.string(),
    customerId: z.string().nullable(),
    newCustomer: customerFormSchema.nullable(),
    items: z.array(orderItemRowSchema).min(1, { message: "validation.atLeastOneItem" }),
    expectedDeliveryDate: z.string().min(1, { message: "validation.deliveryDateRequired" }),
    isUrgent: z.boolean().default(false),
    assignedStaffId: z.string().default(""),
    discountType: z.enum(["amount", "percent"]),
    discountValue: z.number().min(0, { message: "validation.discountInvalid" }),
    adjustment: z.number().min(-50, { message: "validation.adjustmentRange" }).max(50, { message: "validation.adjustmentRange" }),
    adjustmentNote: z.string().max(200).default(""),
    advanceAmount: z.number().min(0, { message: "validation.advanceInvalid" }),
    advanceMethod: z.union([
      z.enum(["cash", "bkash", "nagad", "rocket", "bank", "cheque"]),
      z.literal(""),
    ]),
    notes: z.string().max(300).default(""),
    // "সরাসরি ডেলিভারড হিসেবে সেভ করুন" (১২ আগস্ট ২০২৬) — দেখুন
    // lib/types/order.ts-এর NewOrderFormInput-এ markAsDelivered/deliveredDate
    // কমেন্ট।
    markAsDelivered: z.boolean().default(false),
    deliveredDate: z.string().default(""),
  })
  .refine((data) => data.customerId !== null || data.newCustomer !== null, {
    message: "validation.customerRequired",
    path: ["customerId"],
  })
  .refine(
    (data) => data.discountType !== "percent" || data.discountValue <= 100,
    { message: "validation.discountPercentRange", path: ["discountValue"] }
  )
  .refine(
    (data) => data.advanceAmount === 0 || data.advanceMethod !== "",
    { message: "validation.advanceMethodRequired", path: ["advanceMethod"] }
  )
  .refine((data) => !data.markAsDelivered || data.deliveredDate !== "", {
    message: "validation.deliveredDateRequired",
    path: ["deliveredDate"],
  })
  .refine(
    (data) => {
      if (!data.markAsDelivered || !data.deliveredDate) return true;
      return new Date(data.deliveredDate) <= new Date();
    },
    { message: "validation.deliveredDateFuture", path: ["deliveredDate"] }
  );

export type NewOrderSchemaType = z.infer<typeof newOrderSchema>;

export const recordPaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number({ invalid_type_error: "validation.amountInvalid" }).positive({ message: "validation.amountMustBePositive" }),
  paymentMethod: z.enum(["cash", "bkash", "nagad", "rocket", "bank", "cheque"]),
  referenceNumber: z.string().max(50).default(""),
  notes: z.string().max(200).default(""),
});

export type RecordPaymentSchemaType = z.infer<typeof recordPaymentSchema>;

export const statusChangeSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["pending", "in_progress", "ready", "delivered", "cancelled"]),
});

export const reassignStaffSchema = z.object({
  orderId: z.string().min(1),
  staffId: z.string().min(1, { message: "validation.staffRequired" }),
});
