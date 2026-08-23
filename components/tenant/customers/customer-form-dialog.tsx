"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
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
import { customerFormSchema } from "@/lib/validations/order";
import { createCustomer, updateCustomer } from "@/lib/firebase/customers";
import type { z } from "zod";
import type { Customer } from "@/lib/types/customer";

type FormValues = z.infer<typeof customerFormSchema>;

const EMPTY_VALUES: FormValues = {
  name: "",
  phone: "",
  email: "",
  address: "",
  companyName: "",
};

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  editingCustomer: Customer | null;
  onSaved?: (customerId: string) => void;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  tenantId,
  editingCustomer,
  onSaved,
}: CustomerFormDialogProps) {
  const t = useTranslations();
  const isEdit = editingCustomer !== null;

  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editingCustomer
        ? {
            name: editingCustomer.name,
            phone: editingCustomer.phone,
            email: editingCustomer.email,
            address: editingCustomer.address,
            companyName: editingCustomer.companyName,
          }
        : EMPTY_VALUES
    );
  }, [open, editingCustomer, reset]);

  const getError = (key: keyof FormValues) => {
    const msg = errors[key]?.message;
    return msg ? t(msg as Parameters<typeof t>[0]) : null;
  };

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit && editingCustomer) {
        await updateCustomer(tenantId, editingCustomer.id, values);
        onSaved?.(editingCustomer.id);
      } else {
        const newId = await createCustomer(tenantId, values);
        onSaved?.(newId);
      }
      onOpenChange(false);
    } catch {
      setFieldError("root", { message: t("customers.saveFailed") });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventOutsideClose>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("customers.editCustomer") : t("customers.newCustomer")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
          <div>
            <Label htmlFor="customerFormName">{t("customers.name")} *</Label>
            <Input id="customerFormName" {...register("name")} />
            {getError("name") && <p className="mt-1 text-xs text-status-danger">{getError("name")}</p>}
          </div>

          <div>
            <Label htmlFor="customerFormPhone">{t("customers.phone")} *</Label>
            <Input id="customerFormPhone" {...register("phone")} placeholder="01XXXXXXXXX" />
            {getError("phone") && <p className="mt-1 text-xs text-status-danger">{getError("phone")}</p>}
          </div>

          <div>
            <Label htmlFor="customerFormEmail">{t("customers.email")}</Label>
            <Input id="customerFormEmail" type="email" {...register("email")} />
            {getError("email") && <p className="mt-1 text-xs text-status-danger">{getError("email")}</p>}
          </div>

          <div>
            <Label htmlFor="customerFormCompany">{t("customers.companyName")}</Label>
            <Input id="customerFormCompany" {...register("companyName")} />
          </div>

          <div>
            <Label htmlFor="customerFormAddress">{t("customers.address")}</Label>
            <Input id="customerFormAddress" {...register("address")} />
          </div>

          {errors.root?.message && (
            <p className="text-xs text-status-danger">{errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
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
