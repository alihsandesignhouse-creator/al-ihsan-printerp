"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { setBranchActive } from "@/lib/firebase/branches";
import type { Branch } from "@/lib/types/dashboard";

interface ToggleBranchActiveDialogProps {
  tenantId: string;
  branch: Branch | null;
  onOpenChange: (open: boolean) => void;
}

export function ToggleBranchActiveDialog({
  tenantId,
  branch,
  onOpenChange,
}: ToggleBranchActiveDialogProps) {
  const t = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!branch) return null;
  const willActivate = !branch.isActive;

  async function handleConfirm() {
    if (!branch) return;
    setIsSubmitting(true);
    try {
      await setBranchActive(tenantId, branch.id, willActivate);
      toast.success(willActivate ? t("settings.branch.activated") : t("settings.branch.deactivated"));
      onOpenChange(false);
    } catch {
      toast.error(t("settings.branch.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog open={!!branch} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {willActivate ? t("settings.branch.activateTitle") : t("settings.branch.deactivateTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {willActivate
              ? t("settings.branch.activateConfirm", { name: branch.name })
              : t("settings.branch.deactivateConfirm", { name: branch.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
            {t("common.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
