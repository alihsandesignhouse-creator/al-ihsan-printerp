"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Ticket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { couponFormSchema, type CouponFormSchema } from "@/lib/validations/subscription-plan";
import { createCoupon, updateCoupon, isCouponCodeTaken } from "@/lib/firebase/subscription-plans";
import type { CouponCode } from "@/lib/types/subscription-plan";
import { toast } from "sonner";

interface CouponFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCoupon: CouponCode | null;
  adminId: string;
}

const EMPTY_VALUES: CouponFormSchema = {
  code: "",
  discountType: "percent",
  discountValue: 10,
  validFrom: "",
  validUntil: "",
  maxUses: "",
  isActive: true,
};

export function CouponFormModal({ open, onOpenChange, editingCoupon, adminId }: CouponFormModalProps) {
  const t = useTranslations("sa");
  const [loading, setLoading] = useState(false);
  const isEdit = editingCoupon !== null;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<CouponFormSchema>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (editingCoupon) {
      reset({
        code: editingCoupon.code,
        discountType: editingCoupon.discountType,
        discountValue: editingCoupon.discountValue,
        validFrom: editingCoupon.validFrom.toDate().toISOString().slice(0, 10),
        validUntil: editingCoupon.validUntil.toDate().toISOString().slice(0, 10),
        maxUses: editingCoupon.maxUses === null ? "" : String(editingCoupon.maxUses),
        isActive: editingCoupon.isActive,
      });
    } else {
      reset(EMPTY_VALUES);
    }
  }, [open, editingCoupon, reset]);

  const fieldClass =
    "h-10 w-full border border-neutral-200 rounded-lg px-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors";
  const labelClass = "text-sm font-medium mb-1 block text-neutral-700";
  const errorClass = "text-xs text-red-500 mt-1";

  const errKey = (msg: string | undefined) => (msg ? t(`subscriptionPlans.couponErrors.${msg}`) : null);

  const onSubmit = async (data: CouponFormSchema) => {
    setLoading(true);
    try {
      const maxUsesNum = data.maxUses.trim() === "" ? null : Number(data.maxUses);
      const validFrom = new Date(data.validFrom);
      const validUntil = new Date(data.validUntil);

      if (!isEdit) {
        const taken = await isCouponCodeTaken(data.code);
        if (taken) {
          setError("code", { message: "duplicate" });
          setLoading(false);
          return;
        }
        await createCoupon(
          {
            code: data.code,
            discountType: data.discountType,
            discountValue: data.discountValue,
            validFrom,
            validUntil,
            maxUses: maxUsesNum,
            isActive: data.isActive,
          },
          adminId
        );
      } else {
        await updateCoupon(editingCoupon.id, {
          discountType: data.discountType,
          discountValue: data.discountValue,
          validFrom,
          validUntil,
          maxUses: maxUsesNum,
          isActive: data.isActive,
        });
      }
      toast.success(t("subscriptionPlans.saveSuccess"));
      onOpenChange(false);
    } catch (err) {
      toast.error(t("subscriptionPlans.saveError"));
      if (process.env.NODE_ENV === "development") console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" preventOutsideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-brand-primary" />
            {isEdit ? t("subscriptionPlans.editCoupon") : t("subscriptionPlans.newCoupon")}
          </DialogTitle>
          <DialogDescription>{t("subscriptionPlans.couponSubtitle")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div>
            <Label className={labelClass}>{t("subscriptionPlans.couponCode")} *</Label>
            <input
              {...register("code")}
              disabled={isEdit}
              placeholder="EID2026"
              className={`${fieldClass} uppercase ${isEdit ? "bg-neutral-50 text-neutral-500" : ""}`}
            />
            {errors.code && <p className={errorClass}>{errKey(errors.code.message)}</p>}
            {isEdit && <p className="mt-1 text-xs text-neutral-400">{t("subscriptionPlans.codeImmutable")}</p>}
          </div>

          {/* বাগ-ফিক্স (২১ আগস্ট ২০২৬, সুপার-অ্যাডমিন মোবাইল অডিট): sm: প্রিফিক্স যোগ, মোবাইলে stack করবে */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>{t("subscriptionPlans.discountType")} *</Label>
              <Controller
                name="discountType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-10 border-neutral-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{t("subscriptionPlans.discountPercent")}</SelectItem>
                      <SelectItem value="amount">{t("subscriptionPlans.discountAmount")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label className={labelClass}>{t("subscriptionPlans.discountValue")} *</Label>
              <input type="number" inputMode="decimal" min={0} step="1" {...register("discountValue")} className={fieldClass} />
              {errors.discountValue && <p className={errorClass}>{errKey(errors.discountValue.message)}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>{t("subscriptionPlans.validFrom")} *</Label>
              <input type="date" {...register("validFrom")} className={fieldClass} />
              {errors.validFrom && <p className={errorClass}>{errKey(errors.validFrom.message)}</p>}
            </div>
            <div>
              <Label className={labelClass}>{t("subscriptionPlans.validUntil")} *</Label>
              <input type="date" {...register("validUntil")} className={fieldClass} />
              {errors.validUntil && <p className={errorClass}>{errKey(errors.validUntil.message)}</p>}
            </div>
          </div>

          <div>
            <Label className={labelClass}>{t("subscriptionPlans.maxUses")}</Label>
            <input
              type="number"
              min={0}
              step="1"
              placeholder={t("subscriptionPlans.unlimitedPlaceholder")}
              {...register("maxUses")}
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-neutral-400">{t("subscriptionPlans.blankMeansUnlimited")}</p>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2.5">
            <Label className="text-sm font-medium text-neutral-700">{t("subscriptionPlans.isActive")}</Label>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="bg-brand-primary hover:bg-brand-primary/90 text-white">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("subscriptionPlans.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
