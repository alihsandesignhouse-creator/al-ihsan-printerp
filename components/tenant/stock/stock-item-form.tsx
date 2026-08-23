"use client";

import { useEffect, useState } from "react";
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
import { createStockItem, updateStockItem } from "@/lib/firebase/stock";
import type { Branch } from "@/lib/types/dashboard";
import type { StockItem } from "@/lib/types/stock";

interface StockItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  branches: Branch[];
  defaultBranchId: string | "all";
  editingItem: StockItem | null;
  onSaved?: () => void;
}

interface FormFields {
  name: string;
  category: string;
  unit: string;
  branchId: string;
  openingStock: string;
  minimumLevel: string;
}

const EMPTY_FORM: FormFields = {
  name: "",
  category: "",
  unit: "",
  branchId: "",
  openingStock: "0",
  minimumLevel: "0",
};

export function StockItemFormDialog({
  open,
  onOpenChange,
  tenantId,
  branches,
  defaultBranchId,
  editingItem,
  onSaved,
}: StockItemFormProps) {
  const t = useTranslations();
  const isEdit = editingItem !== null;

  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setFields({
        name: editingItem.name,
        category: editingItem.category,
        unit: editingItem.unit,
        branchId: editingItem.branchId,
        openingStock: String(editingItem.currentStock),
        minimumLevel: String(editingItem.minimumLevel),
      });
    } else {
      setFields({
        ...EMPTY_FORM,
        branchId: defaultBranchId !== "all" ? defaultBranchId : (branches[0]?.id ?? ""),
      });
    }
    setError(null);
  }, [open, editingItem, defaultBranchId, branches]);

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!fields.name.trim()) return t("validation.itemNameRequired");
    if (!fields.unit.trim()) return t("stock.unitRequired");
    if (branches.length > 0 && !fields.branchId) return t("validation.branchRequired");
    const minLevel = Number(fields.minimumLevel);
    if (Number.isNaN(minLevel) || minLevel < 0) return t("stock.minimumLevelInvalid");
    if (!isEdit) {
      const opening = Number(fields.openingStock);
      if (Number.isNaN(opening) || opening < 0) return t("stock.openingStockInvalid");
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (isEdit && editingItem) {
        await updateStockItem(tenantId, editingItem.id, {
          name: fields.name,
          category: fields.category,
          unit: fields.unit,
          minimumLevel: Number(fields.minimumLevel),
        });
      } else {
        await createStockItem(tenantId, {
          name: fields.name,
          category: fields.category,
          unit: fields.unit,
          branchId: fields.branchId,
          openingStock: Number(fields.openingStock),
          minimumLevel: Number(fields.minimumLevel),
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError(t("stock.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventOutsideClose>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("stock.editItem") : t("stock.newItem")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="stockName">{t("stock.itemName")} *</Label>
            <Input id="stockName" value={fields.name} onChange={(e) => update("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="stockCategory">{t("stock.category")}</Label>
              <Input
                id="stockCategory"
                value={fields.category}
                onChange={(e) => update("category", e.target.value)}
                placeholder={t("stock.categoryPlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="stockUnit">{t("stock.unit")} *</Label>
              <Input
                id="stockUnit"
                value={fields.unit}
                onChange={(e) => update("unit", e.target.value)}
                placeholder={t("stock.unitPlaceholder")}
              />
            </div>
          </div>

          {branches.length > 0 && (
            <div>
              <Label htmlFor="stockBranch">{t("stock.branch")} *</Label>
              <select
                id="stockBranch"
                value={fields.branchId}
                onChange={(e) => update("branchId", e.target.value)}
                disabled={isEdit}
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{t("stock.selectBranch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="stockOpening">{t("stock.openingStock")} {!isEdit && "*"}</Label>
              <Input
                id="stockOpening"
                type="number"
                min={0}
                step="any"
                value={fields.openingStock}
                onChange={(e) => update("openingStock", e.target.value)}
                disabled={isEdit}
              />
              {isEdit && <p className="mt-1 text-xs text-neutral-400">{t("stock.useTransactionToChange")}</p>}
            </div>
            <div>
              <Label htmlFor="stockMinLevel">{t("stock.minimumLevel")} *</Label>
              <Input
                id="stockMinLevel"
                type="number"
                min={0}
                step="any"
                value={fields.minimumLevel}
                onChange={(e) => update("minimumLevel", e.target.value)}
              />
            </div>
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
