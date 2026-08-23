"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changeNameSchema, type ChangeNameFormValues } from "@/lib/validations/profile";
import { updateDisplayName } from "@/lib/firebase/profile";
import { auth } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { AuthUser } from "@/lib/types/auth";

interface ChangeNameFormProps {
  authUser: AuthUser;
  onUpdated: (name: string) => void;
}

export function ChangeNameForm({ authUser, onUpdated }: ChangeNameFormProps) {
  const t = useTranslations();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangeNameFormValues>({
    resolver: zodResolver(changeNameSchema),
    defaultValues: { name: authUser.displayName ?? "" },
  });

  async function onSubmit(values: ChangeNameFormValues) {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    try {
      await updateDisplayName(firebaseUser, authUser, values.name);
      const updated: AuthUser = { ...authUser, displayName: values.name.trim() };
      setUser(updated);
      onUpdated(values.name.trim());
      toast.success(t("profile.name.saved"));
    } catch {
      toast.error(t("profile.name.saveFailed"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">
          {t("profile.name.label")}
        </Label>
        <Input
          {...register("name")}
          aria-invalid={!!errors.name}
          className="max-w-sm"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-status-danger">{t(errors.name.message ?? "")}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? t("common.loading") : t("common.save")}
      </Button>
    </form>
  );
}
