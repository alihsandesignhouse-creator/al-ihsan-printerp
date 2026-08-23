"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setStaffActiveStatus } from "@/lib/firebase/users";
import type { StaffMember } from "@/lib/types/user";

interface ToggleStaffActiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember | null;
  onDone: () => void;
}

export function ToggleStaffActiveDialog({
  open,
  onOpenChange,
  staff,
  onDone,
}: ToggleStaffActiveDialogProps) {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);

  if (!staff) return null;

  const willActivate = !staff.isActive;

  async function handleConfirm() {
    if (!staff) return;
    setIsLoading(true);
    try {
      await setStaffActiveStatus({ userId: staff.id, isActive: willActivate });
      toast.success(
        willActivate ? t("users.toast.activated") : t("users.toast.deactivated")
      );
      onDone();
      onOpenChange(false);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code.includes("resource-exhausted")) {
        toast.error(t("users.toast.limitReached"));
      } else {
        toast.error(willActivate ? t("users.toast.activateFailed") : t("users.toast.deactivateFailed"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {willActivate ? t("users.dialog.activateTitle") : t("users.dialog.deactivateTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {willActivate
              ? t("users.dialog.activateDesc", { name: staff.name })
              : t("users.dialog.deactivateDesc", { name: staff.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={
              willActivate
                ? "bg-brand-primary text-white hover:bg-brand-primary/90"
                : "bg-status-danger text-white hover:bg-status-danger/90"
            }
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isLoading
              ? t("common.loading")
              : willActivate
              ? t("users.dialog.confirmActivate")
              : t("users.dialog.confirmDeactivate")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
