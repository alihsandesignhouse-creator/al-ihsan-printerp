"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveAsNameSchema, type SaveAsNameValues } from "@/lib/validations/cost-calculator";

interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleKey: string;
  labelKey: string;
  placeholderKey: string;
  successMessageKey: string;
  failureMessageKey: string;
  onSave: (name: string) => Promise<void>;
}

export function SaveAsDialog({
  open,
  onOpenChange,
  titleKey,
  labelKey,
  placeholderKey,
  successMessageKey,
  failureMessageKey,
  onSave,
}: SaveAsDialogProps) {
  const t = useTranslations();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SaveAsNameValues>({
    resolver: zodResolver(saveAsNameSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (open) reset({ name: "" });
  }, [open, reset]);

  async function onSubmit(values: SaveAsNameValues) {
    try {
      await onSave(values.name);
      toast.success(t(successMessageKey));
      onOpenChange(false);
    } catch {
      toast.error(t(failureMessageKey));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t(labelKey)}</Label>
            <Input
              {...register("name")}
              placeholder={t(placeholderKey)}
              aria-invalid={!!errors.name}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.name.message ?? "")}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
