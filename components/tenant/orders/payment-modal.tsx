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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordPayment } from "@/lib/firebase/orders";
import { PAYMENT_METHODS } from "@/lib/types/order";
import type { PaymentMethod } from "@/lib/types/order";
import { useAuthStore } from "@/lib/stores/auth-store";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  orderId: string;
  currentDue: number;
  onRecorded?: () => void;
}

export function PaymentModal({ open, onOpenChange, tenantId, orderId, currentDue, onRecorded }: PaymentModalProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const [amount, setAmount] = useState<string>(currentDue > 0 ? String(currentDue) : "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError(t("orders.amountMustBePositive"));
      return;
    }
    if (numericAmount > currentDue) {
      setError(t("orders.amountExceedsDue"));
      return;
    }
    if (!user) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await recordPayment(tenantId, user.uid, {
        orderId,
        amount: numericAmount,
        paymentMethod: method,
        referenceNumber: reference,
        notes,
      });
      setAmount("");
      setReference("");
      setNotes("");
      onRecorded?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error && err.message === "orders.amountExceedsDue" ? t("orders.amountExceedsDue") : t("orders.paymentFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("orders.recordPayment")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="paymentAmount">{t("orders.amount")} *</Label>
            <Input
              id="paymentAmount"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="paymentMethod">{t("orders.paymentMethodLabel")}</Label>
            <select
              id="paymentMethod"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`orders.paymentMethod.${m}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="paymentReference">{t("orders.referenceNumber")}</Label>
            <Input id="paymentReference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="paymentNotes">{t("orders.notes")}</Label>
            <Textarea id="paymentNotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-status-danger">{error}</p>}
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
            {t("orders.savePayment")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
