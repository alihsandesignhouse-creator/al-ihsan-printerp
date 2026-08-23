"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { zakatPaymentSchema, type ZakatPaymentValues } from "@/lib/validations/zakat";
import { addZakatPayment } from "@/lib/firebase/zakat";
import { ZAKAT_CATEGORIES } from "@/lib/types/zakat";

interface ZakatPaymentDialogProps {
  tenantId: string;
  zakatYearId: string;
  hijriYear: string;
  actorUid: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** blueprint ZK-02: "তারিখ, হিজরি বছর, পরিমাণ, পদ্ধতি, খাত (কুরআনের ৮টি খাত), গ্রহীতার নাম (ঐচ্ছিক)"। */
export function ZakatPaymentDialog({
  tenantId,
  zakatYearId,
  hijriYear,
  actorUid,
  open,
  onOpenChange,
  onRecorded,
}: ZakatPaymentDialogProps) {
  const t = useTranslations();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ZakatPaymentValues>({
    resolver: zodResolver(zakatPaymentSchema),
    defaultValues: { date: todayIso(), amount: 0, method: "", category: "fakir", recipientName: "", notes: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({ date: todayIso(), amount: 0, method: "", category: "fakir", recipientName: "", notes: "" });
  }, [open, reset]);

  async function onSubmit(values: ZakatPaymentValues) {
    try {
      await addZakatPayment(tenantId, zakatYearId, hijriYear, actorUid, {
        date: values.date,
        amount: values.amount,
        method: values.method,
        category: values.category as ZakatPaymentValues["category"],
        recipientName: values.recipientName,
        notes: values.notes,
      });
      toast.success(t("zakat.paymentRecorded"));
      onOpenChange(false);
      onRecorded();
    } catch {
      toast.error(t("zakat.saveFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("zakat.recordDistribution")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.paymentDate")}</Label>
            <Input type="date" {...register("date")} aria-invalid={!!errors.date} />
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.amount")}</Label>
            <Input type="number" step="0.01" min="0" {...register("amount", { valueAsNumber: true })} aria-invalid={!!errors.amount} />
            {errors.amount && <p className="mt-1 text-xs text-status-danger">{t(errors.amount.message ?? "")}</p>}
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.method")}</Label>
            <Input {...register("method")} placeholder={t("zakat.methodPlaceholder")} aria-invalid={!!errors.method} />
            {errors.method && <p className="mt-1 text-xs text-status-danger">{t(errors.method.message ?? "")}</p>}
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.category")}</Label>
            <Select value={watch("category")} onValueChange={(v) => setValue("category", v as ZakatPaymentValues["category"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZAKAT_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {t(`zakat.categoryName.${category}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.recipientName")}</Label>
            <Input {...register("recipientName")} />
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.notes")}</Label>
            <Textarea {...register("notes")} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? t("common.loading") : t("zakat.recordDistribution")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
