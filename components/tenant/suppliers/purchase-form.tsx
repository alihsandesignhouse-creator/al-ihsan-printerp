"use client";

/**
 * "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচার, ধাপ ৩ (১৭ আগস্ট ২০২৬) — "ক্রয়
 * করুন" ফর্ম। components/tenant/orders/order-form.tsx-এর কাঠামো ইচ্ছাকৃতভাবে
 * অনুসরণ করা হয়েছে (একই শেয়ার্ড components/shared/transaction-item-rows.tsx
 * ও components/shared/transaction-financial-fields.tsx ব্যবহার করে) — শুধু
 * পার্থক্য: এখানে কোনো কাস্টমার-পিকার, ডেলিভারি-স্ট্যাটাস workflow, বা
 * স্টাফ-অ্যাসাইনমেন্ট নেই, এবং সাবমিটে orders কালেকশনের বদলে
 * lib/firebase/suppliers.ts-এর recordItemizedSupplierPurchase() কল হয়
 * (supplier_transactions-এ লেখে)।
 *
 * শাখা: অর্ডার ফর্মের মতো ব্যবহারকারীকে শাখা বেছে নিতে হয় না — সাপ্লায়ার
 * প্রোফাইল ইতিমধ্যে একটা নির্দিষ্ট শাখার সাথে যুক্ত (ঠিক supplier-transaction-
 * modal.tsx/recordSupplierTransaction()-এর মতোই, যা কখনো branchId জিজ্ঞেস
 * করে না), তাই ক্রয় স্বয়ংক্রিয়ভাবে supplier.branchId-তেই রেকর্ড হয়।
 *
 * এই কম্পোনেন্টটা এখনো কোনো পেজ/মোডাল থেকে রেন্ডার করা হচ্ছে না — সেই
 * ওয়্যারিং (দ্বৈত প্রোফাইল পেজে "ক্রয় করুন" বাটন ইত্যাদি) পরিকল্পনার ধাপ ৬-এ
 * পরের সেশনে হবে। এই ফর্ম নিজে সম্পূর্ণ, স্বনির্ভর ও ব্যবহারযোগ্য — শুধু props
 * দিয়ে যেকোনো পেজ/ডায়ালগ থেকে বসানো যাবে।
 */

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TransactionItemRows, createEmptyTransactionItemRow } from "@/components/shared/transaction-item-rows";
import { TransactionFinancialFields } from "@/components/shared/transaction-financial-fields";
import { supplierPurchaseSchema, type SupplierPurchaseSchemaType } from "@/lib/validations/supplier";
import { recordItemizedSupplierPurchase, type RecordItemizedPurchaseResult } from "@/lib/firebase/suppliers";
import { getActiveItemMasterOptions } from "@/lib/firebase/items";
import { calcEffectiveLineTotal, computeOrderTotals } from "@/lib/utils/calculations";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Supplier } from "@/lib/types/supplier";
import type { DiscountType, ItemMasterEntry, PaymentMethod } from "@/lib/types/order";

interface PurchaseFormProps {
  tenantId: string;
  supplier: Supplier;
  onSuccess?: (result: RecordItemizedPurchaseResult) => void;
  onCancel?: () => void;
}

export function PurchaseForm({ tenantId, supplier, onSuccess, onCancel }: PurchaseFormProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);

  const [itemMasterOptions, setItemMasterOptions] = useState<ItemMasterEntry[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SupplierPurchaseSchemaType>({
    resolver: zodResolver(supplierPurchaseSchema),
    defaultValues: {
      branchId: supplier.branchId,
      items: [createEmptyTransactionItemRow()],
      discountType: "amount",
      discountValue: 0,
      adjustment: 0,
      advanceAmount: 0,
      advanceMethod: "",
      referenceNumber: "",
      note: "",
    },
  });

  const itemsFieldArray = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const watchedDiscountType = watch("discountType");
  const watchedDiscountValue = watch("discountValue");
  const watchedAdjustment = watch("adjustment");
  const watchedAdvance = watch("advanceAmount");

  useEffect(() => {
    if (!tenantId) return;
    getActiveItemMasterOptions(tenantId).then(setItemMasterOptions).catch(() => setItemMasterOptions([]));
  }, [tenantId]);

  const totals = computeOrderTotals({
    lineTotals: watchedItems.map((it) => calcEffectiveLineTotal(it.quantity || 0, it.unitPrice || 0, it.totalOverride ?? null)),
    discountType: watchedDiscountType as DiscountType,
    discountValue: watchedDiscountValue || 0,
    adjustment: watchedAdjustment || 0,
    advanceAmount: watchedAdvance || 0,
  });

  async function onSubmit(data: SupplierPurchaseSchemaType) {
    if (!tenantId || !user) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await recordItemizedSupplierPurchase(
        tenantId,
        user.uid,
        user.displayName ?? user.email ?? "",
        supplier.id,
        {
          ...data,
          branchId: supplier.branchId,
          advanceMethod: (data.advanceMethod || "") as PaymentMethod | "",
        },
        t("suppliers.purchaseAdvanceNote")
      );
      onSuccess?.(result);
    } catch {
      setSubmitError(t("suppliers.purchaseFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  // order-form.tsx-এর মতোই defensive সেফটি-নেট — কোনো কারণে ভ্যালিডেশন
  // ব্যর্থ হলেও ব্যবহারকারী অন্তত একটা দৃশ্যমান বার্তা দেখবেন।
  function onInvalid() {
    setSubmitError(t("suppliers.purchaseFailed"));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
        <p className="font-medium text-neutral-900">{supplier.name}</p>
        {supplier.phone && <p className="text-xs text-neutral-500">{supplier.phone}</p>}
      </div>

      {/* ক্রয়ের আইটেম */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t("suppliers.purchaseItemsSection")}</h3>
        <TransactionItemRows
          rows={itemsFieldArray.fields as unknown as typeof watchedItems}
          onChange={(rows) => {
            itemsFieldArray.replace(rows);
          }}
          error={errors.items?.message ? t(errors.items.message) : undefined}
          itemMasterOptions={itemMasterOptions}
          tenantId={tenantId}
          onItemMasterEntryUpdated={(updated) =>
            setItemMasterOptions((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
          }
        />
      </section>

      {/* আর্থিক তথ্য */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t("orders.financialSection")}</h3>
        <TransactionFinancialFields
          subtotal={totals.subtotal}
          discountType={watchedDiscountType as DiscountType}
          onDiscountTypeChange={(v) => setValue("discountType", v, { shouldValidate: true })}
          discountValue={watchedDiscountValue || 0}
          onDiscountValueChange={(v) => setValue("discountValue", v, { shouldValidate: true })}
          discountError={errors.discountValue ? t(errors.discountValue.message ?? "") : undefined}
          adjustment={watchedAdjustment || 0}
          onAdjustmentChange={(v) => setValue("adjustment", v, { shouldValidate: true })}
          adjustmentError={errors.adjustment ? t(errors.adjustment.message ?? "") : undefined}
          totalAmount={totals.totalAmount}
          advanceAmount={watchedAdvance || 0}
          onAdvanceAmountChange={(v) => setValue("advanceAmount", v, { shouldValidate: true })}
          advanceMethod={(watch("advanceMethod") || "") as PaymentMethod | ""}
          onAdvanceMethodChange={(v) => setValue("advanceMethod", v, { shouldValidate: true })}
          advanceMethodError={errors.advanceMethod ? t(errors.advanceMethod.message ?? "") : undefined}
          dueAmount={totals.dueAmount}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="purchaseReferenceNumber">{t("suppliers.referenceNumber")}</Label>
            <Input id="purchaseReferenceNumber" {...register("referenceNumber")} />
          </div>
          <div>
            <Label htmlFor="purchaseNote">{t("suppliers.note")}</Label>
            <Textarea id="purchaseNote" rows={1} {...register("note")} />
          </div>
        </div>
      </section>

      {submitError && (
        <p className="flex items-center gap-1.5 text-sm text-status-danger">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 items-center gap-2 rounded-lg border border-neutral-200 px-5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            {t("common.cancel")}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("suppliers.recordPurchaseAction")}
        </button>
      </div>
    </form>
  );
}
