"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { processWithdrawal } from "@/lib/firebase/commission";
import { formatTaka } from "@/lib/utils/calculations";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { StaffWithdrawal } from "@/lib/types/commission";

interface ProcessWithdrawalDialogProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawal: StaffWithdrawal | null;
  onDone: () => void;
}

export function ProcessWithdrawalDialog({
  tenantId,
  open,
  onOpenChange,
  withdrawal,
  onDone,
}: ProcessWithdrawalDialogProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);

  const [adjustedAmount, setAdjustedAmount] = useState<string>("");
  const [adminNote, setAdminNote] = useState("");
  const [isLoading, setIsLoading] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    if (!open || !withdrawal) return;
    setAdjustedAmount(String(withdrawal.requestedAmount));
    setAdminNote("");
  }, [open, withdrawal]);

  if (!withdrawal) return null;

  async function handleAction(action: "approve" | "reject") {
    if (!withdrawal || !user) return;
    setIsLoading(action);
    try {
      const parsedAmount = Number(adjustedAmount);
      const amountChanged =
        action === "approve" && !Number.isNaN(parsedAmount) && parsedAmount !== withdrawal.requestedAmount;

      await processWithdrawal(
        tenantId,
        { uid: user.uid, name: user.displayName ?? user.email ?? "" },
        withdrawal.id,
        {
          action,
          adjustedAmount: amountChanged ? parsedAmount : null,
          adminNote,
        }
      );
      toast.success(action === "approve" ? t("commission.approved") : t("commission.rejected"));
      onDone();
      onOpenChange(false);
    } catch {
      toast.error(t("commission.processFailed"));
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("commission.reviewRequest")}</DialogTitle>
          <DialogDescription>
            {withdrawal.staffName} — {t(`commission.withdrawalType.${withdrawal.type}`)}
            {withdrawal.type === "commission" && withdrawal.month ? ` (${withdrawal.month})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {t("commission.requestedAmount")}:{" "}
            <span className="font-semibold text-neutral-900">{formatTaka(withdrawal.requestedAmount)}</span>
          </p>

          {withdrawal.note && (
            <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{withdrawal.note}</p>
          )}

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("commission.approvedAmount")}
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={adjustedAmount}
              onChange={(e) => setAdjustedAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-neutral-400">{t("commission.adjustedAmountHint")}</p>
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("commission.adminNote")}
            </Label>
            <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            disabled={isLoading !== null}
            onClick={() => handleAction("reject")}
          >
            {isLoading === "reject" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("commission.reject")}
          </Button>
          <Button type="button" disabled={isLoading !== null} onClick={() => handleAction("approve")}>
            {isLoading === "approve" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("commission.approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
