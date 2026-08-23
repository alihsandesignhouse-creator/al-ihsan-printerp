"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ShoppingCart, Banknote } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { recordSupplierTransaction } from "@/lib/firebase/suppliers";
import { useAuthStore } from "@/lib/stores/auth-store";
import { PAYMENT_METHODS } from "@/lib/types/order";
import type { Supplier, SupplierTransactionType, PaymentMethod } from "@/lib/types/supplier";

interface SupplierTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  supplier: Supplier | null;
  defaultType?: SupplierTransactionType;
  onRecorded?: () => void;
}

const TYPE_OPTIONS: { type: SupplierTransactionType; icon: typeof ShoppingCart }[] = [
  { type: "purchase", icon: ShoppingCart },
  { type: "payment", icon: Banknote },
];

export function SupplierTransactionModal({
  open,
  onOpenChange,
  tenantId,
  supplier,
  defaultType = "purchase",
  onRecorded,
}: SupplierTransactionModalProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);

  const [type, setType] = useState<SupplierTransactionType>(defaultType);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setAmount("");
    setMethod("cash");
    setReference("");
    setNote("");
    setError(null);
  }, [open, defaultType]);

  if (!supplier) return null;

  const numericAmount = Number(amount);
  const previewNewDue =
    amount && !Number.isNaN(numericAmount)
      ? type === "purchase"
        ? supplier.currentDue + numericAmount
        : supplier.currentDue - numericAmount
      : null;

  async function handleSubmit() {
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError(t("validation.amountMustBePositive"));
      return;
    }
    if (!user || !supplier) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await recordSupplierTransaction(tenantId, user.uid, user.displayName ?? user.email ?? "", supplier.id, {
        type,
        amount: numericAmount,
        paymentMethod: type === "payment" ? method : "",
        referenceNumber: reference,
        note,
      });
      onRecorded?.();
      onOpenChange(false);
    } catch {
      setError(t("suppliers.transactionFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("suppliers.recordTransaction")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            <p className="font-medium text-neutral-900">{supplier.name}</p>
            <p className="text-xs text-neutral-500">
              {t("suppliers.currentDue")}:{" "}
              {supplier.currentDue < 0
                ? t("suppliers.advanceAmount", { amount: Math.abs(supplier.currentDue) })
                : `${t("common.taka")}${supplier.currentDue}`}
            </p>
          </div>

          <div>
            <Label>{t("suppliers.transactionType")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(({ type: optType, icon: Icon }) => (
                <button
                  key={optType}
                  type="button"
                  onClick={() => setType(optType)}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors",
                    type === optType
                      ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                      : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(`suppliers.type.${optType}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="supplierTxAmount">{t("suppliers.amount")} *</Label>
            <Input
              id="supplierTxAmount"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {previewNewDue !== null && (
              <p className="mt-1 text-xs text-neutral-400">
                {t("suppliers.newDuePreview")}:{" "}
                {previewNewDue < 0
                  ? t("suppliers.advanceAmount", { amount: Math.abs(previewNewDue) })
                  : `${t("common.taka")}${previewNewDue}`}
              </p>
            )}
          </div>

          {type === "payment" && (
            <div>
              <Label htmlFor="supplierTxMethod">{t("suppliers.paymentMethodLabel")}</Label>
              <select
                id="supplierTxMethod"
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
          )}

          <div>
            <Label htmlFor="supplierTxReference">{t("suppliers.referenceNumber")}</Label>
            <Input id="supplierTxReference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="supplierTxNote">{t("suppliers.note")}</Label>
            <Textarea id="supplierTxNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-xs text-status-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
