"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/super-admin/ConfirmDialog";
import { softDeleteCustomer } from "@/lib/firebase/customers";
import type { Customer } from "@/lib/types/customer";

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  userId: string;
  customer: Customer | null;
  onDeleted?: () => void;
}

export function DeleteCustomerDialog({
  open,
  onOpenChange,
  tenantId,
  userId,
  customer,
  onDeleted,
}: DeleteCustomerDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!customer) return;
    setLoading(true);
    try {
      await softDeleteCustomer(tenantId, customer.id, userId);
      onOpenChange(false);
      onDeleted?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("customers.deleteTitle")}
      description={t("customers.deleteDescription", { name: customer?.name ?? "" })}
      confirmLabel={t("common.delete")}
      cancelLabel={t("common.cancel")}
      onConfirm={handleConfirm}
      destructive
      loading={loading}
    />
  );
}
