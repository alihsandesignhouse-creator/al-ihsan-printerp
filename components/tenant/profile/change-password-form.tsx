"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changePasswordSchema, type ChangePasswordFormValues } from "@/lib/validations/profile";
import { changeOwnPassword } from "@/lib/firebase/profile";
import { auth } from "@/lib/firebase/client";

function mapPasswordError(code: string): string {
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "profile.password.wrongCurrent";
  }
  if (code.includes("weak-password")) return "profile.password.newMin";
  if (code.includes("requires-recent-login")) return "profile.password.reauthRequired";
  return "profile.password.saveFailed";
}

export function ChangePasswordForm() {
  const t = useTranslations();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    try {
      await changeOwnPassword(firebaseUser, values.currentPassword, values.newPassword);
      toast.success(t("profile.password.saved"));
      reset();
    } catch (err) {
      const code = err instanceof Error ? err.message : "unknown";
      toast.error(t(mapPasswordError(code)));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4">
      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">
          {t("profile.password.current")}
        </Label>
        <div className="relative">
          <Input
            type={showCurrent ? "text" : "password"}
            {...register("currentPassword")}
            aria-invalid={!!errors.currentPassword}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.currentPassword && (
          <p className="mt-1 text-xs text-status-danger">{t(errors.currentPassword.message ?? "")}</p>
        )}
      </div>

      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">
          {t("profile.password.new")}
        </Label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            {...register("newPassword")}
            aria-invalid={!!errors.newPassword}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.newPassword && (
          <p className="mt-1 text-xs text-status-danger">{t(errors.newPassword.message ?? "")}</p>
        )}
      </div>

      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">
          {t("profile.password.confirm")}
        </Label>
        <Input
          type={showNew ? "text" : "password"}
          {...register("confirmPassword")}
          aria-invalid={!!errors.confirmPassword}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-xs text-status-danger">{t(errors.confirmPassword.message ?? "")}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? t("common.loading") : t("profile.password.submit")}
      </Button>
    </form>
  );
}
