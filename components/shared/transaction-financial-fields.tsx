"use client";

/**
 * "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচার, ধাপ ২ (১৭ আগস্ট ২০২৬) — অর্ডার
 * ফর্মের (components/tenant/orders/order-form.tsx) "আর্থিক তথ্য" সেকশনের
 * সাবটোটাল/ছাড়/অ্যাডজাস্টমেন্ট/চূড়ান্ত-বিল/অগ্রিম/বকেয়া অংশটুকু এখান থেকে
 * বের করে আনা হয়েছে, যাতে নতুন সাপ্লায়ার "ক্রয় করুন" ফর্মেও (components/
 * tenant/suppliers/purchase-form.tsx) হুবহু একই UI/আচরণ ব্যবহার করা যায় —
 * ভবিষ্যতে এই অংশে পরিবর্তন আনলে দুই জায়গাতেই এক সাথে প্রতিফলিত হবে।
 *
 * ইচ্ছাকৃতভাবে React Hook Form-এর register/control সরাসরি নেয় না — বদলে
 * সাধারণ controlled value/onChange props নেয় (CustomerPicker/OrderItemRows-
 * এর মতোই এই কোডবেসের established প্যাটার্ন), যাতে অর্ডার ও ক্রয় — দুটো
 * সম্পূর্ণ আলাদা Zod schema/ফর্ম থেকেও এই একই কম্পোনেন্ট নিরাপদে ব্যবহার করা
 * যায়, কোনো generic RHF টাইপ-জটিলতা ছাড়াই।
 *
 * সাবটোটাল ও চূড়ান্ত-বিল/বকেয়ার হিসাব ক্যালিং কম্পোনেন্ট নিজে
 * lib/utils/calculations.ts-এর computeOrderTotals() দিয়ে করে এখানে
 * result হিসেবে পাস করে — এই কম্পোনেন্ট নিজে কোনো হিসাব করে না, শুধু UI।
 */

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatTaka } from "@/lib/utils/calculations";
import { PAYMENT_METHODS } from "@/lib/types/order";
import type { DiscountType, PaymentMethod } from "@/lib/types/order";
import { useTranslations } from "next-intl";

export interface TransactionFinancialFieldsProps {
  subtotal: number;
  discountType: DiscountType;
  onDiscountTypeChange: (value: DiscountType) => void;
  discountValue: number;
  onDiscountValueChange: (value: number) => void;
  discountError?: string;
  adjustment: number;
  onAdjustmentChange: (value: number) => void;
  adjustmentError?: string;
  totalAmount: number;
  advanceAmount: number;
  onAdvanceAmountChange: (value: number) => void;
  advanceMethod: PaymentMethod | "";
  onAdvanceMethodChange: (value: PaymentMethod | "") => void;
  advanceMethodError?: string;
  dueAmount: number;
  /** অগ্রিম ফিল্ড দুটো (amount/method) দেখানো হবে কিনা — ডিফল্ট true।
   *  ভবিষ্যতে কোনো প্রেক্ষাপটে (যেমন শুধু আইটেম হিসাব, কোনো পেমেন্ট ছাড়া)
   *  লুকাতে চাইলে false দেওয়া যাবে। */
  showAdvance?: boolean;
}

export function TransactionFinancialFields({
  subtotal,
  discountType,
  onDiscountTypeChange,
  discountValue,
  onDiscountValueChange,
  discountError,
  adjustment,
  onAdjustmentChange,
  adjustmentError,
  totalAmount,
  advanceAmount,
  onAdvanceAmountChange,
  advanceMethod,
  onAdvanceMethodChange,
  advanceMethodError,
  dueAmount,
  showAdvance = true,
}: TransactionFinancialFieldsProps) {
  const t = useTranslations();

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <Label>{t("orders.subtotal")}</Label>
        <p className="flex h-10 items-center font-mono text-sm font-medium">{formatTaka(subtotal)}</p>
      </div>
      <div>
        <Label htmlFor="txDiscountValue">{t("orders.discount")}</Label>
        <div className="flex gap-2">
          <select
            value={discountType}
            onChange={(e) => onDiscountTypeChange(e.target.value as DiscountType)}
            className="h-10 w-20 rounded-lg border border-neutral-200 px-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="amount">৳</option>
            <option value="percent">%</option>
          </select>
          <Input
            id="txDiscountValue"
            type="number"
            min={0}
            step="any"
            value={discountValue}
            onChange={(e) => onDiscountValueChange(Number(e.target.value))}
          />
        </div>
        {discountError && <p className="mt-1 text-xs text-status-danger">{discountError}</p>}
      </div>
      <div>
        <Label htmlFor="txAdjustment">{t("orders.adjustment")}</Label>
        <Input
          id="txAdjustment"
          type="number"
          step="any"
          value={adjustment}
          onChange={(e) => onAdjustmentChange(Number(e.target.value))}
        />
        {adjustmentError && <p className="mt-1 text-xs text-status-danger">{adjustmentError}</p>}
      </div>
      <div>
        <Label>{t("orders.totalAmount")}</Label>
        <p className="flex h-10 items-center font-mono text-base font-semibold text-brand-primary">
          {formatTaka(totalAmount)}
        </p>
      </div>
      {showAdvance && (
        <>
          <div>
            <Label htmlFor="txAdvanceAmount">{t("orders.advanceAmount")}</Label>
            <Input
              id="txAdvanceAmount"
              type="number"
              min={0}
              step="any"
              value={advanceAmount}
              onChange={(e) => onAdvanceAmountChange(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="txAdvanceMethod">{t("orders.advanceMethod")}</Label>
            <select
              id="txAdvanceMethod"
              value={advanceMethod}
              onChange={(e) => onAdvanceMethodChange(e.target.value as PaymentMethod | "")}
              className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="">{t("orders.selectMethod")}</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`orders.paymentMethod.${m}`)}
                </option>
              ))}
            </select>
            {advanceMethodError && <p className="mt-1 text-xs text-status-danger">{advanceMethodError}</p>}
          </div>
        </>
      )}
      <div>
        <Label>{t("orders.dueAmount")}</Label>
        <p className="flex h-10 items-center font-mono text-base font-semibold text-status-danger">
          {formatTaka(dueAmount)}
        </p>
      </div>
    </div>
  );
}
