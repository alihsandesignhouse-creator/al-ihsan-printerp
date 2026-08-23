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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { withdrawalRequestSchema, type WithdrawalRequestValues } from "@/lib/validations/commission";
import { requestWithdrawal } from "@/lib/firebase/commission";
import { WITHDRAWAL_TYPES, type WithdrawalType } from "@/lib/types/commission";
import { currentYearMonth } from "@/lib/utils/commission-math";

interface WithdrawalRequestDialogProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: { id: string; name: string; branchId: string };
  defaultCommissionMonth?: string;
}

export function WithdrawalRequestDialog({
  tenantId,
  open,
  onOpenChange,
  staff,
  defaultCommissionMonth,
}: WithdrawalRequestDialogProps) {
  const t = useTranslations();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WithdrawalRequestValues>({
    resolver: zodResolver(withdrawalRequestSchema),
    defaultValues: {
      type: "commission",
      month: defaultCommissionMonth ?? currentYearMonth(),
      amount: 0,
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      type: "commission",
      month: defaultCommissionMonth ?? currentYearMonth(),
      amount: 0,
      note: "",
    });
  }, [open, defaultCommissionMonth, reset]);

  const watchedType = watch("type");

  async function onSubmit(values: WithdrawalRequestValues) {
    try {
      await requestWithdrawal(tenantId, staff, {
        type: values.type as WithdrawalType,
        month: values.type === "commission" ? values.month : "",
        amount: values.amount,
        note: values.note,
      });
      toast.success(t("commission.requestSubmitted"));
      onOpenChange(false);
    } catch {
      toast.error(t("commission.requestFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("commission.newWithdrawalRequest")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("commission.withdrawalTypeLabel")}
            </Label>
            <Select value={watch("type")} onValueChange={(v) => setValue("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WITHDRAWAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`commission.withdrawalType.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {watchedType === "commission" && (
            <div>
              <Label className="mb-1 block text-sm font-medium text-neutral-700">
                {t("commission.forMonth")}
              </Label>
              <Input type="month" {...register("month")} />
            </div>
          )}

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("commission.amount")}
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...register("amount", { valueAsNumber: true })}
              aria-invalid={!!errors.amount}
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.amount.message ?? "")}</p>
            )}
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("commission.note")}
            </Label>
            <Textarea {...register("note")} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? t("common.loading") : t("commission.submitRequest")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
