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
import { Button } from "@/components/ui/button";
import { zakatYearStartSchema, type ZakatYearStartValues } from "@/lib/validations/zakat";
import { createZakatYear } from "@/lib/firebase/zakat";

interface ZakatYearStartDialogProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (yearId: string) => void;
}

function defaultHawlEnd(startIso: string): string {
  const start = startIso ? new Date(startIso) : new Date();
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return end.toISOString().slice(0, 10);
}

export function ZakatYearStartDialog({ tenantId, open, onOpenChange, onCreated }: ZakatYearStartDialogProps) {
  const t = useTranslations();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ZakatYearStartValues>({
    resolver: zodResolver(zakatYearStartSchema),
    defaultValues: {
      hijriYear: "",
      hawlStart: new Date().toISOString().slice(0, 10),
      hawlEnd: defaultHawlEnd(new Date().toISOString().slice(0, 10)),
    },
  });

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    reset({ hijriYear: "", hawlStart: today, hawlEnd: defaultHawlEnd(today) });
  }, [open, reset]);

  async function onSubmit(values: ZakatYearStartValues) {
    try {
      const yearId = await createZakatYear(tenantId, values);
      toast.success(t("zakat.yearStarted"));
      onOpenChange(false);
      onCreated(yearId);
    } catch {
      toast.error(t("zakat.saveFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("zakat.startNewYear")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.hijriYear")}</Label>
            <Input {...register("hijriYear")} placeholder="১৪৪৭" aria-invalid={!!errors.hijriYear} />
            {errors.hijriYear && <p className="mt-1 text-xs text-status-danger">{t(errors.hijriYear.message ?? "")}</p>}
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.hawlStart")}</Label>
            <Input type="date" {...register("hawlStart")} aria-invalid={!!errors.hawlStart} />
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.hawlEnd")}</Label>
            <Input type="date" {...register("hawlEnd")} aria-invalid={!!errors.hawlEnd} />
            {errors.hawlEnd && <p className="mt-1 text-xs text-status-danger">{t(errors.hawlEnd.message ?? "")}</p>}
          </div>

          <p className="text-xs text-neutral-400">{t("zakat.startNewYearHint")}</p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? t("common.loading") : t("zakat.startNewYear")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
