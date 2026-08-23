"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
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
import { recordStockTransaction } from "@/lib/firebase/stock";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { StockItem, StockTransactionType } from "@/lib/types/stock";

interface StockTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  item: StockItem | null;
  defaultType?: StockTransactionType;
  onRecorded?: () => void;
}

const TYPE_OPTIONS: { type: StockTransactionType; icon: typeof ArrowDownToLine }[] = [
  { type: "in", icon: ArrowDownToLine },
  { type: "out", icon: ArrowUpFromLine },
  { type: "adjustment", icon: SlidersHorizontal },
];

export function StockTransactionModal({
  open,
  onOpenChange,
  tenantId,
  item,
  defaultType = "in",
  onRecorded,
}: StockTransactionModalProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);

  const [type, setType] = useState<StockTransactionType>(defaultType);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setAmount(type === "adjustment" && item ? String(item.currentStock) : "");
    setNote("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultType, item]);

  useEffect(() => {
    if (!open || !item) return;
    if (type === "adjustment") {
      setAmount(String(item.currentStock));
    } else {
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (!item) return null;

  const previewNewStock = (() => {
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount)) return null;
    if (type === "in") return item.currentStock + numericAmount;
    if (type === "out") return item.currentStock - numericAmount;
    return numericAmount;
  })();

  async function handleSubmit() {
    const numericAmount = Number(amount);
    if (!amount || Number.isNaN(numericAmount) || numericAmount < 0) {
      setError(t("validation.amountInvalid"));
      return;
    }
    if (type !== "adjustment" && numericAmount <= 0) {
      setError(t("validation.amountMustBePositive"));
      return;
    }
    if (!user || !item) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await recordStockTransaction(tenantId, user.uid, user.displayName ?? user.email ?? "", item.id, {
        type,
        amount: numericAmount,
        note,
      });
      setAmount("");
      setNote("");
      onRecorded?.();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && err.message === "stock.insufficientStock") {
        setError(t("stock.insufficientStock"));
      } else {
        setError(t("stock.transactionFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("stock.recordTransaction")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            <p className="font-medium text-neutral-900">{item.name}</p>
            <p className="text-xs text-neutral-500">
              {t("stock.currentStock")}: {item.currentStock} {item.unit}
            </p>
          </div>

          <div>
            <Label>{t("stock.transactionType")}</Label>
            <div className="grid grid-cols-3 gap-2">
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
                  {t(`stock.type.${optType}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="txAmount">
              {type === "adjustment" ? t("stock.newStockValue") : t("stock.quantity")} *
            </Label>
            <Input
              id="txAmount"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {previewNewStock !== null && (
              <p className="mt-1 text-xs text-neutral-400">
                {t("stock.newStockPreview")}: {previewNewStock} {item.unit}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="txNote">{t("stock.note")}</Label>
            <Textarea id="txNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
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
