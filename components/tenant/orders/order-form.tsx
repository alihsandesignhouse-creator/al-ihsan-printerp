"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2, FileText } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { newOrderSchema, type NewOrderSchemaType } from "@/lib/validations/order";
import { CustomerPicker } from "./customer-picker";
import { TransactionItemRows, createEmptyTransactionItemRow } from "@/components/shared/transaction-item-rows";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { createOrder, getActiveStaffOptions } from "@/lib/firebase/orders";
import { getActiveItemMasterOptions } from "@/lib/firebase/items";
import { getQuotationOnce, getQuotationItemsOnce, markQuotationConverted } from "@/lib/firebase/quotations";
import { calcEffectiveLineTotal, computeOrderTotals } from "@/lib/utils/calculations";
import type { Branch } from "@/lib/types/dashboard";
import type { Customer, CustomerFormData, StaffOption, DiscountType, PaymentMethod, ItemMasterEntry } from "@/lib/types/order";
import { TransactionFinancialFields } from "@/components/shared/transaction-financial-fields";
import { useAuthStore } from "@/lib/stores/auth-store";

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface OrderFormProps {
  /** Set when navigated here from an Accepted quotation's "অর্ডারে রূপান্তর করুন" button (T-14). */
  prefillQuotationId?: string;
  /**
   * ধাপ ৬ (১৭ আগস্ট ২০২৬) — দ্বৈত কাস্টমার+সাপ্লায়ার প্রোফাইলের "বিক্রি
   * করুন" বাটন থেকে নেভিগেট করলে সেট থাকে (?customerId=...)। কাস্টমার
   * পিকার এড়িয়ে সরাসরি এই কাস্টমার প্রি-সিলেক্ট করা থাকে — prefillQuotationId-
   * এর getDoc প্যাটার্নই পুনর্ব্যবহার করা হয়েছে। দুটো prop একসাথে ব্যবহারের
   * কথা নয় (হয় কোটেশন থেকে, নয়তো লিংকড প্রোফাইল থেকে)।
   */
  prefillCustomerId?: string;
}

export function OrderForm({ prefillQuotationId, prefillCustomerId }: OrderFormProps = {}) {
  const t = useTranslations();
  const handleFirestoreError = useFirestoreErrorHandler();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const userBranchId = user?.claims.branchId ?? null;
  const canPickAnyStaff = role === "tenant_admin" || role === "branch_manager";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [itemMasterOptions, setItemMasterOptions] = useState<ItemMasterEntry[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefillQuotationNumber, setPrefillQuotationNumber] = useState<string | null>(null);
  const [isPrefilling, setIsPrefilling] = useState(Boolean(prefillQuotationId) || Boolean(prefillCustomerId));

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewOrderSchemaType>({
    resolver: zodResolver(newOrderSchema),
    defaultValues: {
      branchId: userBranchId ?? "",
      customerId: null,
      newCustomer: null,
      items: [createEmptyTransactionItemRow()],
      expectedDeliveryDate: todayPlusDays(3),
      isUrgent: false,
      assignedStaffId: canPickAnyStaff ? "" : (user?.uid ?? ""),
      discountType: "amount",
      discountValue: 0,
      adjustment: 0,
      adjustmentNote: "",
      advanceAmount: 0,
      advanceMethod: "",
      notes: "",
    },
  });

  const itemsFieldArray = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const watchedBranchId = watch("branchId");
  const watchedDiscountType = watch("discountType");
  const watchedDiscountValue = watch("discountValue");
  const watchedAdjustment = watch("adjustment");
  const watchedAdvance = watch("advanceAmount");

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    getActiveItemMasterOptions(tenantId).then(setItemMasterOptions).catch(() => setItemMasterOptions([]));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const branchFilter = watchedBranchId || "all";
    getActiveStaffOptions(tenantId, branchFilter).then(setStaffOptions).catch(() => setStaffOptions([]));
  }, [tenantId, watchedBranchId]);

  useEffect(() => {
    if (!canPickAnyStaff && user?.uid) {
      setValue("assignedStaffId", user.uid);
    }
  }, [canPickAnyStaff, user?.uid, setValue]);

  // বাগ-ফিক্স (১২ আগস্ট ২০২৬): branchId স্কিমাতে required (min ১), কিন্তু
  // নিচের JSX-এ branchId <select> শুধু branches.length > 1 হলে দেখায় (একটাই
  // শাখা থাকলে dropdown দেখানোর দরকার নেই)। tenant_admin-এর claim-এ কোনো
  // branchId থাকে না (সব শাখা দেখতে পান বলে), তাই এক-শাখার টেন্যান্টে
  // defaultValues-এর branchId "" থেকেই যাচ্ছিল — select field-টা লুকানো
  // থাকায় ব্যবহারকারী কখনো সেটা পূরণ করতে পারতেন না, ফলে zodResolver
  // নিঃশব্দে ভ্যালিডেশন আটকে দিত (onSubmit কখনো কল হতো না) — বাটনে ক্লিক
  // করলে কিছুই হতো না বলে মনে হতো। quotation-form.tsx ও
  // costing/page.tsx-এ ইতিমধ্যে থাকা একই fallback প্যাটার্ন এখানেও আনা হলো।
  useEffect(() => {
    if (!watchedBranchId && branches.length > 0) {
      setValue(
        "branchId",
        branches.length === 1 ? branches[0]!.id : (userBranchId ?? branches[0]!.id),
        { shouldValidate: true }
      );
    }
  }, [branches, watchedBranchId, userBranchId, setValue]);

  // T-14: Accepted quotation → "অর্ডারে রূপান্তর করুন" নেভিগেট করে এখানে
  // ?fromQuotation={id} সহ। কোটেশনের সব ডেটা এখানে কপি করে ফর্ম প্রি-ফিল করা
  // হয় (স্টাফ রিভিউ করে সাবমিট করবেন) — কোনো সরাসরি/অ্যাটোমেটিক অর্ডার তৈরি
  // নয়, যাতে ভুল বা অসম্পূর্ণ তথ্য রিভিউ ছাড়াই অর্ডারে না যায়।
  useEffect(() => {
    if (!tenantId || !prefillQuotationId) {
      // prefillCustomerId থাকলে সেই effect নিজেই isPrefilling(false) সেট
      // করবে (নিচে দেখুন) — এখানে সেট করলে race condition তৈরি হয়ে
      // কাস্টমার-ফেচ শেষ হওয়ার আগেই skeleton সরে যেত।
      if (!prefillCustomerId) setIsPrefilling(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const quotation = await getQuotationOnce(tenantId, prefillQuotationId);
        if (!quotation || cancelled) return;
        const items = await getQuotationItemsOnce(tenantId, prefillQuotationId);
        if (cancelled) return;

        setPrefillQuotationNumber(quotation.quotationNumber);
        setValue("branchId", quotation.branchId, { shouldValidate: true });
        setValue("notes", quotation.notes, { shouldValidate: true });

        if (quotation.customerId) {
          const customerSnap = await getDoc(doc(db, "tenants", tenantId, "customers", quotation.customerId));
          if (!cancelled && customerSnap.exists()) {
            const customer = { id: customerSnap.id, ...customerSnap.data() } as Customer;
            setSelectedCustomer(customer);
            setValue("customerId", customer.id, { shouldValidate: true });
            setValue("newCustomer", null);
          }
        } else {
          setValue(
            "newCustomer",
            {
              name: quotation.recipientName,
              phone: quotation.recipientPhone,
              email: "",
              address: "",
              companyName: quotation.recipientCompany,
            },
            { shouldValidate: true }
          );
          setValue("customerId", null);
        }

        if (items.length > 0) {
          itemsFieldArray.replace(
            items.map((item) => ({
              rowId: `row-${item.id}`,
              itemName: item.itemName,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalOverride: null,
              addToItemMaster: false,
              selectedAttributes: item.selectedAttributes ?? [],
            }))
          );
        }
      } finally {
        if (!cancelled) setIsPrefilling(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
    return () => {
      cancelled = true;
    };
    // itemsFieldArray থেকে শুধু .replace মেথড ব্যবহার হচ্ছে বলে dependency-তে
    // পুরো itemsFieldArray রাখা হয়নি (প্রতি রেন্ডারে নতুন রেফারেন্স তৈরি হয়,
    // অসীম লুপ এড়াতে)।
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, prefillQuotationId, setValue]);

  // ধাপ ৬ (১৭ আগস্ট ২০২৬) — দ্বৈত প্রোফাইলের "বিক্রি করুন" বাটন থেকে এলে
  // (prefillQuotationId না থাকলেই শুধু, দুটো prefill একসাথে প্রযোজ্য নয়)
  // সরাসরি সেই কাস্টমার প্রি-সিলেক্ট করা হয় — উপরের কোটেশন-প্রিফিল useEffect-
  // এর একই getDoc প্যাটার্ন।
  useEffect(() => {
    if (!tenantId || !prefillCustomerId || prefillQuotationId) return;
    let cancelled = false;
    (async () => {
      try {
        const customerSnap = await getDoc(doc(db, "tenants", tenantId, "customers", prefillCustomerId));
        if (!cancelled && customerSnap.exists()) {
          const customer = { id: customerSnap.id, ...customerSnap.data() } as Customer;
          setSelectedCustomer(customer);
          setValue("customerId", customer.id, { shouldValidate: true });
          setValue("newCustomer", null);
        }
      } finally {
        if (!cancelled) setIsPrefilling(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, prefillCustomerId, prefillQuotationId, setValue]);

  const totals = useMemo(
    () =>
      computeOrderTotals({
        lineTotals: watchedItems.map((it) =>
          calcEffectiveLineTotal(it.quantity || 0, it.unitPrice || 0, it.totalOverride ?? null)
        ),
        discountType: watchedDiscountType as DiscountType,
        discountValue: watchedDiscountValue || 0,
        adjustment: watchedAdjustment || 0,
        advanceAmount: watchedAdvance || 0,
      }),
    [watchedItems, watchedDiscountType, watchedDiscountValue, watchedAdjustment, watchedAdvance]
  );

  async function onSubmit(data: NewOrderSchemaType) {
    if (!tenantId || !user) return;
    setSubmitError(null);
    // বাগ-ফিক্স (১৫ আগস্ট ২০২৬, শূন্য-শাখা / একক-মালিক): branchId এখন
    // স্কিমাতে বাধ্যতামূলক নয় (lib/validations/order.ts দ্রষ্টব্য), তাই
    // আসল required-check এখানে expense-form-dialog.tsx-এর প্যাটার্নে —
    // branches.length > 0 হলে তবেই branchId বাধ্যতামূলক। branches.length
    // === 0 হলে (স্বাক্ষরিত হওয়ার কথা নয়, কারণ signup route এখন সবসময়
    // একটা ডিফল্ট শাখা তৈরি করে — তবু কোনো পুরনো/আক্রান্ত টেন্যান্টের
    // জন্য defense-in-depth হিসেবে) খালি branchId নিয়েই অর্ডার তৈরি হতে
    // দেওয়া হয়, যাতে সিস্টেম কখনো স্থায়ীভাবে আটকে না যায়।
    if (branches.length > 0 && !data.branchId) {
      setSubmitError(t("validation.branchRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createOrder(tenantId, user.uid, {
        ...data,
        advanceMethod: (data.advanceMethod || "") as PaymentMethod | "",
      });
      if (prefillQuotationId) {
        // এই কল ব্যর্থ হলেও অর্ডার ইতিমধ্যে সফলভাবে তৈরি হয়ে গেছে — তাই এটার
        // ব্যর্থতা ব্যবহারকারীকে ব্লক করা বা অর্ডার তৈরির সাফল্য প্রশ্নবিদ্ধ করা
        // উচিত নয়, শুধু লিংকিং মেটাডেটা আপডেট (best-effort)।
        markQuotationConverted(tenantId, prefillQuotationId, result.orderId).catch(() => undefined);
      }
      router.push(`/dashboard/orders/${result.orderId}`);
    } catch {
      setSubmitError(t("orders.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Defensive সেফটি-নেট: কোনো কারণে ভ্যালিডেশন ব্যর্থ হলে (এমনকি লুকানো/অদৃশ্য
  // ফিল্ডের কারণে হলেও) ব্যবহারকারী যেন অন্তত একটা দৃশ্যমান বার্তা দেখেন —
  // বাটন ক্লিকে "কিছুই হয়নি" মনে হওয়া এড়াতে।
  function onInvalid() {
    setSubmitError(t("orders.createFailed"));
  }

  if (!tenantId) return null;

  if (isPrefilling) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      {prefillQuotationNumber && (
        <div className="flex items-center gap-2 rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-3 text-sm text-brand-primary">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("orders.prefilledFromQuotation", { number: prefillQuotationNumber })}
        </div>
      )}

      {/* কাস্টমার */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t("orders.customerSection")}</h3>
        <CustomerPicker
          tenantId={tenantId}
          selectedCustomer={selectedCustomer}
          newCustomer={watch("newCustomer")}
          onSelectExisting={(c) => {
            setSelectedCustomer(c);
            setValue("customerId", c.id, { shouldValidate: true });
            setValue("newCustomer", null);
          }}
          onCreateNew={(data: CustomerFormData) => {
            setSelectedCustomer(null);
            setValue("newCustomer", data, { shouldValidate: true });
            setValue("customerId", null);
          }}
          onClear={() => {
            setSelectedCustomer(null);
            setValue("customerId", null);
            setValue("newCustomer", null);
          }}
          error={errors.customerId ? t(errors.customerId.message ?? "") : undefined}
        />
      </section>

      {/* অর্ডার আইটেম */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t("orders.itemsSection")}</h3>
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

      {/* ডেলিভারি ও অ্যাসাইনমেন্ট */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t("orders.deliverySection")}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {branches.length > 1 && (
            <div>
              <Label htmlFor="branchId">{t("orders.branch")} *</Label>
              <select
                id="branchId"
                {...register("branchId")}
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">{t("orders.selectBranch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {errors.branchId && <p className="mt-1 text-xs text-status-danger">{t(errors.branchId.message ?? "")}</p>}
            </div>
          )}
          <div>
            <Label htmlFor="expectedDeliveryDate">{t("orders.deliveryDate")} *</Label>
            <Input id="expectedDeliveryDate" type="date" {...register("expectedDeliveryDate")} />
            {errors.expectedDeliveryDate && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.expectedDeliveryDate.message ?? "")}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input id="markAsDelivered" type="checkbox" className="h-4 w-4" {...register("markAsDelivered")} />
            <Label htmlFor="markAsDelivered" className="cursor-pointer">{t("orders.markAsDelivered")}</Label>
          </div>
          {watch("markAsDelivered") && (
            <div>
              <Label htmlFor="deliveredDate">{t("orders.deliveredDateLabel")}</Label>
              <Input
                id="deliveredDate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                {...register("deliveredDate")}
              />
              {errors.deliveredDate && (
                <p className="mt-1 text-xs text-status-danger">{t(errors.deliveredDate.message ?? "")}</p>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="assignedStaffId">
              {t("orders.assignedStaff")}
              {!canPickAnyStaff && " *"}
            </Label>
            <select
              id="assignedStaffId"
              {...register("assignedStaffId")}
              disabled={!canPickAnyStaff}
              className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-neutral-50"
            >
              {canPickAnyStaff && <option value="">{t("orders.noStaffAssigned")}</option>}
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {!canPickAnyStaff && user?.displayName && (
                <option value={user.uid}>{user.displayName}</option>
              )}
            </select>
            {errors.assignedStaffId && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.assignedStaffId.message ?? "")}</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            id="isUrgent"
            type="checkbox"
            {...register("isUrgent")}
            className="h-4 w-4 rounded border-neutral-300 text-red-500 focus:ring-red-500"
          />
          <Label htmlFor="isUrgent" className="!mb-0 flex items-center gap-1 text-red-600">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {t("orders.markUrgent")}
          </Label>
        </div>
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
        <div className="mt-3">
          <Label htmlFor="notes">{t("orders.notes")}</Label>
          <Textarea id="notes" rows={2} {...register("notes")} />
        </div>
      </section>

      {submitError && (
        <p className="flex items-center gap-1.5 text-sm text-status-danger">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {submitError}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("orders.createOrder")}
        </button>
      </div>
    </form>
  );
}
