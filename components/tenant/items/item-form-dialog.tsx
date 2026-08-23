"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { itemMasterFormSchema, type ItemMasterFormValues } from "@/lib/validations/item";
import { createItem, updateItem } from "@/lib/firebase/items";
import { ItemAttributeGroupsEditor } from "@/components/tenant/items/item-attribute-groups-editor";
import type { ItemMasterEntry } from "@/lib/types/order";

const EMPTY_VALUES: ItemMasterFormValues = {
  name: "",
  defaultUnitPrice: 0,
  attributeGroups: [],
};

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  editingItem: ItemMasterEntry | null;
}

export function ItemFormDialog({ open, onOpenChange, tenantId, editingItem }: ItemFormDialogProps) {
  const t = useTranslations();
  const isEdit = editingItem !== null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<ItemMasterFormValues>({
    resolver: zodResolver(itemMasterFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  const attributeGroups = watch("attributeGroups");

  useEffect(() => {
    if (!open) return;
    reset(
      editingItem
        ? {
            name: editingItem.name,
            defaultUnitPrice: editingItem.defaultUnitPrice,
            attributeGroups: editingItem.attributeGroups ?? [],
          }
        : EMPTY_VALUES
    );
  }, [open, editingItem, reset]);

  const getError = (key: keyof Omit<ItemMasterFormValues, "attributeGroups">) => {
    const msg = errors[key]?.message;
    return msg ? t(msg as Parameters<typeof t>[0]) : null;
  };

  /**
   * `errors.attributeGroups` থেকে প্রথম যেকোনো nested error message
   * খুঁজে বের করে — group/option-ভিত্তিক আলাদা highlighting-এর বদলে
   * এডিটরের নিচে একটা সাধারণ error line হিসেবে দেখানো হয় (সরলতার জন্য,
   * ধাপ ১-এর স্কোপে যথেষ্ট)।
   */
  function findAttributeGroupsError(): string | null {
    const groupsErrors = errors.attributeGroups;
    if (!groupsErrors) return null;
    if ("message" in groupsErrors && groupsErrors.message) {
      return t(groupsErrors.message as Parameters<typeof t>[0]);
    }
    if (Array.isArray(groupsErrors)) {
      for (const groupError of groupsErrors) {
        if (!groupError) continue;
        if (groupError.name?.message) return t(groupError.name.message as Parameters<typeof t>[0]);
        if (groupError.options?.message) return t(groupError.options.message as Parameters<typeof t>[0]);
        if (Array.isArray(groupError.options)) {
          for (const optionError of groupError.options) {
            if (optionError?.label?.message) return t(optionError.label.message as Parameters<typeof t>[0]);
            if (optionError?.priceAdjustment?.message)
              return t(optionError.priceAdjustment.message as Parameters<typeof t>[0]);
          }
        }
      }
    }
    return null;
  }

  async function onSubmit(values: ItemMasterFormValues) {
    try {
      if (isEdit && editingItem) {
        await updateItem(tenantId, editingItem.id, values);
      } else {
        await createItem(tenantId, values);
      }
      onOpenChange(false);
    } catch {
      setFieldError("root", { message: t("itemMaster.saveFailed") });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventOutsideClose>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("itemMaster.editItem") : t("itemMaster.newItem")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
          <div>
            <Label htmlFor="itemMasterFormName">{t("itemMaster.name")} *</Label>
            <Input id="itemMasterFormName" {...register("name")} />
            {getError("name") && <p className="mt-1 text-xs text-status-danger">{getError("name")}</p>}
          </div>

          <div>
            <Label htmlFor="itemMasterFormPrice">{t("itemMaster.defaultUnitPrice")} *</Label>
            <Input
              id="itemMasterFormPrice"
              type="number"
              min={0}
              step="any"
              {...register("defaultUnitPrice", { valueAsNumber: true })}
            />
            {getError("defaultUnitPrice") && (
              <p className="mt-1 text-xs text-status-danger">{getError("defaultUnitPrice")}</p>
            )}
          </div>

          {errors.root?.message && <p className="text-xs text-status-danger">{errors.root.message}</p>}

          <div className="border-t border-neutral-100 pt-3">
            <ItemAttributeGroupsEditor
              groups={attributeGroups}
              onChange={(groups) => setValue("attributeGroups", groups, { shouldValidate: false })}
              errorText={findAttributeGroupsError()}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
