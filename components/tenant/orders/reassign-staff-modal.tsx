"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { reassignStaff } from "@/lib/firebase/orders";
import type { StaffOption } from "@/lib/types/order";

interface ReassignStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  orderId: string;
  staffOptions: StaffOption[];
  currentStaffId: string | null;
  onReassigned?: () => void;
}

export function ReassignStaffModal({
  open,
  onOpenChange,
  tenantId,
  orderId,
  staffOptions,
  currentStaffId,
  onReassigned,
}: ReassignStaffModalProps) {
  const t = useTranslations();
  const [selected, setSelected] = useState(currentStaffId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selected) {
      setError(t("orders.staffRequired"));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await reassignStaff(tenantId, orderId, selected);
      onReassigned?.();
      onOpenChange(false);
    } catch {
      setError(t("orders.reassignFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("orders.reassignStaff")}</DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="reassignSelect">{t("orders.assignedStaff")}</Label>
          <select
            id="reassignSelect"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="">{t("orders.selectStaff")}</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-lg px-4 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("common.save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
