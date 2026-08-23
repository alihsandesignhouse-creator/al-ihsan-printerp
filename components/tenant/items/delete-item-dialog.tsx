"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/super-admin/ConfirmDialog";
import { softDeleteItem } from "@/lib/firebase/items";
import type { ItemMasterEntry } from "@/lib/types/order";

interface DeleteItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  userId: string;
  item: ItemMasterEntry | null;
}

export function DeleteItemDialog({ open, onOpenChange, tenantId, userId, item }: DeleteItemDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!item) return;
    setLoading(true);
    try {
      await softDeleteItem(tenantId, item.id, userId);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("itemMaster.deleteTitle")}
      description={t("itemMaster.deleteDescription", { name: item?.name ?? "" })}
      confirmLabel={t("common.delete")}
      cancelLabel={t("common.cancel")}
      onConfirm={handleConfirm}
      destructive
      loading={loading}
    />
  );
}
