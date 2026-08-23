"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { editPlanSchema, type EditPlanSchema } from "@/lib/validations/subscription-plan";
import { updateSubscriptionPlan } from "@/lib/firebase/subscription-plans";
import type { SubscriptionPlanCatalogEntry } from "@/lib/types/subscription-plan";
import { ALL_FEATURE_KEYS, DEFAULT_PLAN_FEATURES } from "@/lib/types/tenant";
import { toast } from "sonner";

interface EditPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlanCatalogEntry | null;
  adminId: string;
}

export function EditPlanModal({ open, onOpenChange, plan, adminId }: EditPlanModalProps) {
  const t = useTranslations("sa");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditPlanSchema>({
    resolver: zodResolver(editPlanSchema),
  });

  useEffect(() => {
    if (!plan) return;
    reset({
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      maxStaff: plan.maxStaff === null ? "" : String(plan.maxStaff),
      maxBranches: plan.maxBranches === null ? "" : String(plan.maxBranches),
      featuresBn: plan.featuresBn.join("\n"),
      featuresEn: plan.featuresEn.join("\n"),
      // `plan.features` comes from DEFAULT_PLAN_CATALOG (in-memory fallback)
      // whenever this plan hasn't been saved to Firestore yet, so it's
      // always populated — see subscribeSubscriptionPlans()'s doc comment.
      features: plan.features ?? DEFAULT_PLAN_FEATURES[plan.id],
    });
  }, [plan, reset]);

  const fieldClass =
    "h-10 w-full border border-neutral-200 rounded-lg px-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors";
  const textareaClass =
    "w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors";
  const labelClass = "text-sm font-medium mb-1 block text-neutral-700";
  const errorClass = "text-xs text-red-500 mt-1";

  const onSubmit = async (data: EditPlanSchema) => {
    if (!plan) return;
    setLoading(true);
    try {
      const maxStaffNum = data.maxStaff.trim() === "" ? null : Number(data.maxStaff);
      const maxBranchesNum = data.maxBranches.trim() === "" ? null : Number(data.maxBranches);
      const featuresBn = data.featuresBn.split("\n").map((line) => line.trim()).filter(Boolean);
      const featuresEn = data.featuresEn.split("\n").map((line) => line.trim()).filter(Boolean);
      await updateSubscriptionPlan(
        plan.id,
        {
          monthlyPrice: data.monthlyPrice,
          yearlyPrice: data.yearlyPrice,
          maxStaff: maxStaffNum,
          maxBranches: maxBranchesNum,
          featuresBn,
          featuresEn,
          features: data.features,
        },
        adminId
      );
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" preventOutsideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-primary" />
            {plan ? t(`subscriptionPlans.planName.${plan.id}`) : ""}
          </DialogTitle>
          <DialogDescription>{t("subscriptionPlans.editSubtitle")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* বাগ-ফিক্স (২১ আগস্ট ২০২৬, সুপার-অ্যাডমিন মোবাইল অডিট):
              grid-cols-2 আগে sm: প্রিফিক্স ছাড়া ছিল — ৩২০px স্ক্রিনে
              দুটো number ইনপুট+লেবেল গাদাগাদি হতো। মোবাইলে stack করবে। */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>{t("subscriptionPlans.monthlyPrice")} *</Label>
              <input type="number" inputMode="decimal" min={0} step="1" {...register("monthlyPrice")} className={fieldClass} />
              {errors.monthlyPrice && <p className={errorClass}>{t("subscriptionPlans.required")}</p>}
            </div>
            <div>
              <Label className={labelClass}>{t("subscriptionPlans.yearlyPrice")} *</Label>
              <input type="number" inputMode="decimal" min={0} step="1" {...register("yearlyPrice")} className={fieldClass} />
              {errors.yearlyPrice && <p className={errorClass}>{t("subscriptionPlans.required")}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>{t("subscriptionPlans.maxStaff")}</Label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                placeholder={t("subscriptionPlans.unlimitedPlaceholder")}
                {...register("maxStaff")}
                className={fieldClass}
              />
              <p className="mt-1 text-xs text-neutral-400">{t("subscriptionPlans.blankMeansUnlimited")}</p>
            </div>
            <div>
              <Label className={labelClass}>{t("subscriptionPlans.maxBranches")}</Label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                placeholder={t("subscriptionPlans.unlimitedPlaceholder")}
                {...register("maxBranches")}
                className={fieldClass}
              />
              <p className="mt-1 text-xs text-neutral-400">{t("subscriptionPlans.blankMeansUnlimited")}</p>
            </div>
          </div>

          <div>
            <Label className={labelClass}>{t("subscriptionPlans.featuresBn")} *</Label>
            <textarea rows={6} {...register("featuresBn")} className={textareaClass} />
            <p className="mt-1 text-xs text-neutral-400">{t("subscriptionPlans.oneLinePerFeature")}</p>
            {errors.featuresBn && <p className={errorClass}>{t("subscriptionPlans.required")}</p>}
          </div>

          <div>
            <Label className={labelClass}>{t("subscriptionPlans.featuresEn")} *</Label>
            <textarea rows={6} {...register("featuresEn")} className={textareaClass} />
            <p className="mt-1 text-xs text-neutral-400">{t("subscriptionPlans.oneLinePerFeature")}</p>
            {errors.featuresEn && <p className={errorClass}>{t("subscriptionPlans.required")}</p>}
          </div>

          <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-neutral-800">
                {t("subscriptionPlans.featureToggles")}
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                {t("subscriptionPlans.featureTogglesNote")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_FEATURE_KEYS.map((key) => (
                <label
                  key={key}
                  htmlFor={`feature-${key}`}
                  className="flex items-center gap-2 rounded-lg bg-neutral-50 p-2 text-xs font-medium text-neutral-700 cursor-pointer"
                >
                  <input
                    id={`feature-${key}`}
                    type="checkbox"
                    {...register(`features.${key}`)}
                    className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                  />
                  {t(`features.${key}`)}
                </label>
              ))}
            </div>
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
