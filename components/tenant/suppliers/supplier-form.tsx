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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createSupplierWithOptionalCustomerLink, updateSupplier } from "@/lib/firebase/suppliers";
import type { Branch } from "@/lib/types/dashboard";
import type { Supplier } from "@/lib/types/supplier";

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  branches: Branch[];
  defaultBranchId: string | "all";
  editingSupplier: Supplier | null;
  onSaved?: () => void;
}

interface FormFields {
  name: string;
  phone: string;
  contactPerson: string;
  suppliedItems: string;
  address: string;
  branchId: string;
  openingDue: string;
}

const EMPTY_FORM: FormFields = {
  name: "",
  phone: "",
  contactPerson: "",
  suppliedItems: "",
  address: "",
  branchId: "",
  openingDue: "0",
};

const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

export function SupplierFormDialog({
  open,
  onOpenChange,
  tenantId,
  branches,
  defaultBranchId,
  editingSupplier,
  onSaved,
}: SupplierFormDialogProps) {
  const t = useTranslations();
  const isEdit = editingSupplier !== null;

  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [alsoCreateCustomer, setAlsoCreateCustomer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingSupplier) {
      setFields({
        name: editingSupplier.name,
        phone: editingSupplier.phone,
        contactPerson: editingSupplier.contactPerson,
        suppliedItems: editingSupplier.suppliedItems,
        address: editingSupplier.address,
        branchId: editingSupplier.branchId,
        openingDue: String(editingSupplier.currentDue),
      });
    } else {
      setFields({
        ...EMPTY_FORM,
        branchId: defaultBranchId !== "all" ? defaultBranchId : (branches[0]?.id ?? ""),
      });
      setAlsoCreateCustomer(false);
    }
    setError(null);
  }, [open, editingSupplier, defaultBranchId, branches]);

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!fields.name.trim()) return t("validation.nameRequired");
    if (fields.phone.trim() && !BD_PHONE_REGEX.test(fields.phone.trim())) return t("validation.bdPhoneInvalid");
    if (branches.length > 0 && !fields.branchId) return t("validation.branchRequired");
    if (!isEdit) {
      const opening = Number(fields.openingDue);
      if (Number.isNaN(opening) || opening < 0) return t("suppliers.openingDueInvalid");
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
      if (isEdit && editingSupplier) {
        await updateSupplier(tenantId, editingSupplier.id, {
          name: fields.name,
          phone: fields.phone,
          contactPerson: fields.contactPerson,
          suppliedItems: fields.suppliedItems,
          address: fields.address,
        });
      } else {
        await createSupplierWithOptionalCustomerLink(
          tenantId,
          {
            name: fields.name,
            phone: fields.phone,
            contactPerson: fields.contactPerson,
            suppliedItems: fields.suppliedItems,
            address: fields.address,
            branchId: fields.branchId,
            openingDue: Number(fields.openingDue),
          },
          alsoCreateCustomer
        );
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError(t("suppliers.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventOutsideClose>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("suppliers.editSupplier") : t("suppliers.newSupplier")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="supplierName">{t("suppliers.name")} *</Label>
            <Input id="supplierName" value={fields.name} onChange={(e) => update("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="supplierPhone">{t("suppliers.phone")}</Label>
              <Input id="supplierPhone" value={fields.phone} onChange={(e) => update("phone", e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div>
              <Label htmlFor="supplierContact">{t("suppliers.contactPerson")}</Label>
              <Input id="supplierContact" value={fields.contactPerson} onChange={(e) => update("contactPerson", e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="supplierItems">{t("suppliers.suppliedItems")}</Label>
            <Input
              id="supplierItems"
              value={fields.suppliedItems}
              onChange={(e) => update("suppliedItems", e.target.value)}
              placeholder={t("suppliers.suppliedItemsPlaceholder")}
            />
          </div>

          <div>
            <Label htmlFor="supplierAddress">{t("suppliers.address")}</Label>
            <Textarea id="supplierAddress" rows={2} value={fields.address} onChange={(e) => update("address", e.target.value)} />
          </div>

          {branches.length > 0 && (
            <div>
              <Label htmlFor="supplierBranch">{t("suppliers.branch")} *</Label>
              <select
                id="supplierBranch"
                value={fields.branchId}
                onChange={(e) => update("branchId", e.target.value)}
                disabled={isEdit}
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{t("suppliers.selectBranch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="supplierOpeningDue">{t("suppliers.openingDue")} {!isEdit && "*"}</Label>
            <Input
              id="supplierOpeningDue"
              type="number"
              step="any"
              value={fields.openingDue}
              onChange={(e) => update("openingDue", e.target.value)}
              disabled={isEdit}
            />
            {isEdit ? (
              <p className="mt-1 text-xs text-neutral-400">{t("suppliers.useTransactionToChange")}</p>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">{t("suppliers.openingDueHint")}</p>
            )}
          </div>

          {!isEdit && (
            <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <input
                id="alsoCreateCustomer"
                type="checkbox"
                checked={alsoCreateCustomer}
                onChange={(e) => setAlsoCreateCustomer(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
              />
              <Label htmlFor="alsoCreateCustomer" className="cursor-pointer font-normal text-neutral-700">
                {t("suppliers.alsoCreateCustomer")}
              </Label>
            </div>
          )}

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
