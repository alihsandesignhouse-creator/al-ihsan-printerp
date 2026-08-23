"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { newQuotationSchema, type NewQuotationSchemaType } from "@/lib/validations/quotation";
import { QuotationRecipientPicker } from "./quotation-recipient-picker";
import { QuotationItemRows, createEmptyQuotationItemRow } from "./quotation-item-rows";
import { ImportFromCalculator } from "./import-from-calculator";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeCostCalculations } from "@/lib/firebase/cost-calculator";
import { createQuotation } from "@/lib/firebase/quotations";
import { getActiveItemMasterOptions } from "@/lib/firebase/items";
import { calcEffectiveLineTotal, calcSubtotal, formatTaka } from "@/lib/utils/calculations";
import type { Branch } from "@/lib/types/dashboard";
import type { CostCalculation } from "@/lib/types/cost-calculator";
import type { Customer, ItemMasterEntry } from "@/lib/types/order";
import { useAuthStore } from "@/lib/stores/auth-store";

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function QuotationForm() {
  const t = useTranslations();
  const handleFirestoreError = useFirestoreErrorHandler();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const userBranchId = user?.claims.branchId ?? null;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [calculations, setCalculations] = useState<CostCalculation[]>([]);
  const [itemMasterOptions, setItemMasterOptions] = useState<ItemMasterEntry[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewQuotationSchemaType>({
    resolver: zodResolver(newQuotationSchema),
    defaultValues: {
      branchId: userBranchId ?? "",
      customerId: null,
      recipientName: "",
      recipientPhone: "",
      recipientCompany: "",
      items: [createEmptyQuotationItemRow()],
      validUntil: todayPlusDays(15),
      terms: "",
      notes: "",
    },
  });

  const watchedItems = watch("items");
  const watchedBranchId = watch("branchId");
  const watchedRecipientName = watch("recipientName");
  const watchedRecipientPhone = watch("recipientPhone");
  const watchedRecipientCompany = watch("recipientCompany");

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
    if (!watchedBranchId && branches.length > 0) {
      setValue("branchId", branches.length === 1 ? branches[0]!.id : (userBranchId ?? branches[0]!.id));
    }
  }, [branches, watchedBranchId, userBranchId, setValue]);

  useEffect(() => {
    if (!tenantId || !watchedBranchId) return;
    const unsub = subscribeCostCalculations(tenantId, watchedBranchId, setCalculations, handleFirestoreError());
    return () => unsub();
  }, [tenantId, watchedBranchId, handleFirestoreError]);

  const subtotal = useMemo(
    () =>
      calcSubtotal(
        watchedItems.map((it) => calcEffectiveLineTotal(it.quantity || 0, it.unitPrice || 0, it.totalOverride ?? null))
      ),
    [watchedItems]
  );

  function importCalculation(calc: CostCalculation) {
    const currentItems = watchedItems.filter((it) => it.itemName.trim().length > 0);
    setValue("items", [
      ...currentItems,
      {
        rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        itemName: calc.name,
        description: "",
        quantity: calc.pieceQuantity || 1,
        unitPrice: calc.suggestedSellingPricePerPiece,
        totalOverride: null,
        selectedAttributes: [],
      },
    ]);
  }

  async function onSubmit(data: NewQuotationSchemaType) {
    if (!tenantId || !user) return;
    setSubmitError(null);
    // বাগ-ফিক্স (১৫ আগস্ট ২০২৬, শূন্য-শাখা / একক-মালিক): order-form.tsx-এর
    // identical কারণে — branchId এখন স্কিমাতে বাধ্যতামূলক নয়, তাই আসল
    // required-check এখানে "branches.length > 0 হলে তবেই branchId
    // বাধ্যতামূলক" শর্তসাপেক্ষে করা হচ্ছে।
    if (branches.length > 0 && !data.branchId) {
      setSubmitError(t("validation.branchRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createQuotation(tenantId, user.uid, user.displayName ?? user.email ?? "", data);
      router.push(`/dashboard/quotations/${result.quotationId}`);
    } catch {
      setSubmitError(t("quotations.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Defensive সেফটি-নেট: order-form.tsx-এর onInvalid-এর অনুরূপ — কোনো
  // কারণে zodResolver ভ্যালিডেশন ব্যর্থ হলে ব্যবহারকারী যেন অন্তত একটা
  // দৃশ্যমান বার্তা দেখেন, বাটন ক্লিকে "কিছুই হয়নি" মনে না হয়।
  function onInvalid() {
    setSubmitError(t("quotations.createFailed"));
  }

  if (!tenantId) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      {/* প্রাপক */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t("quotations.recipientSection")}</h3>
        <QuotationRecipientPicker
          tenantId={tenantId}
          selectedCustomer={selectedCustomer}
          recipientName={watchedRecipientName}
          recipientPhone={watchedRecipientPhone}
          recipientCompany={watchedRecipientCompany}
          onSelectExisting={(c) => {
            setSelectedCustomer(c);
            setValue("customerId", c.id, { shouldValidate: true });
            setValue("recipientName", c.name);
            setValue("recipientPhone", c.phone);
            setValue("recipientCompany", c.companyName);
          }}
          onManualChange={(patch) => {
            if (patch.recipientName !== undefined) setValue("recipientName", patch.recipientName, { shouldValidate: true });
            if (patch.recipientPhone !== undefined) setValue("recipientPhone", patch.recipientPhone);
            if (patch.recipientCompany !== undefined) setValue("recipientCompany", patch.recipientCompany);
          }}
          onClear={() => {
            setSelectedCustomer(null);
            setValue("customerId", null);
            setValue("recipientName", "");
            setValue("recipientPhone", "");
            setValue("recipientCompany", "");
          }}
          error={errors.recipientName ? t(errors.recipientName.message ?? "") : undefined}
        />
      </section>

      {/* আইটেম */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t("quotations.itemsSection")}</h3>
        <div className="mb-3">
          <ImportFromCalculator calculations={calculations} onImport={importCalculation} />
        </div>
        <Controller
          control={control}
          name="items"
          render={({ field }) => (
            <QuotationItemRows
              rows={field.value}
              onChange={field.onChange}
              error={errors.items?.message ? t(errors.items.message) : undefined}
              itemMasterOptions={itemMasterOptions}
              tenantId={tenantId}
              onItemMasterEntryUpdated={(updated) =>
                setItemMasterOptions((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
              }
            />
          )}
        />
      </section>

      {/* শাখা ও বৈধতা */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t("quotations.detailsSection")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.length > 1 && (
            <div>
              <Label htmlFor="branchId">{t("quotations.branch")} *</Label>
              <select
                id="branchId"
                {...register("branchId")}
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">{t("quotations.selectBranch")}</option>
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
            <Label htmlFor="validUntil">{t("quotations.validUntil")} *</Label>
            <Input id="validUntil" type="date" {...register("validUntil")} />
            {errors.validUntil && <p className="mt-1 text-xs text-status-danger">{t(errors.validUntil.message ?? "")}</p>}
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="terms">{t("quotations.terms")}</Label>
          <Textarea id="terms" rows={3} {...register("terms")} placeholder={t("quotations.termsPlaceholder")} />
        </div>
        <div className="mt-3">
          <Label htmlFor="notes">{t("quotations.notes")}</Label>
          <Textarea id="notes" rows={2} {...register("notes")} />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-sm font-medium text-neutral-600">{t("quotations.totalAmount")}</span>
          <span className="font-mono text-base font-semibold text-brand-primary">{formatTaka(subtotal)}</span>
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
          {t("quotations.createQuotation")}
        </button>
      </div>
    </form>
  );
}
