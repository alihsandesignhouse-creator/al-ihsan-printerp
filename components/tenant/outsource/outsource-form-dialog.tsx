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
import { Textarea } from "@/components/ui/textarea";
import { createOutsourceRecord, updateOutsourceRecord } from "@/lib/firebase/outsource";
import { useAuthStore } from "@/lib/stores/auth-store";
import { OUTSOURCE_STATUSES } from "@/lib/types/outsource";
import type { OutsourceRecord, OutsourceStatus } from "@/lib/types/outsource";
import type { Branch } from "@/lib/types/dashboard";

interface OutsourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  branches: Branch[];
  defaultBranchId: string | "all";
  editingRecord: OutsourceRecord | null;
  onSaved?: () => void;
}

interface FormFields {
  relatedOrderNumber: string;
  workDescription: string;
  vendorName: string;
  sentDate: string;
  expectedReturnDate: string;
  cost: string;
  status: OutsourceStatus;
  branchId: string;
}

function toIsoDateLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayIso(): string {
  return toIsoDateLocal(new Date());
}

const EMPTY_FORM: FormFields = {
  relatedOrderNumber: "",
  workDescription: "",
  vendorName: "",
  sentDate: "",
  expectedReturnDate: "",
  cost: "",
  status: "sent",
  branchId: "",
};

export function OutsourceFormDialog({
  open,
  onOpenChange,
  tenantId,
  branches,
  defaultBranchId,
  editingRecord,
  onSaved,
}: OutsourceFormDialogProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const isEdit = editingRecord !== null;

  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingRecord) {
      setFields({
        relatedOrderNumber: editingRecord.relatedOrderNumber,
        workDescription: editingRecord.workDescription,
        vendorName: editingRecord.vendorName,
        sentDate: toIsoDateLocal(editingRecord.sentDate.toDate()),
        expectedReturnDate: toIsoDateLocal(editingRecord.expectedReturnDate.toDate()),
        cost: String(editingRecord.cost),
        status: editingRecord.status,
        branchId: editingRecord.branchId,
      });
    } else {
      setFields({
        ...EMPTY_FORM,
        sentDate: todayIso(),
        branchId: defaultBranchId !== "all" ? defaultBranchId : (branches[0]?.id ?? ""),
      });
    }
    setError(null);
  }, [open, editingRecord, defaultBranchId, branches]);

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!fields.workDescription.trim()) return t("outsource.workDescriptionRequired");
    if (!fields.vendorName.trim()) return t("outsource.vendorNameRequired");
    if (!fields.sentDate) return t("validation.dateRequired");
    if (!fields.expectedReturnDate) return t("validation.dateRequired");
    if (fields.sentDate && fields.expectedReturnDate && fields.expectedReturnDate < fields.sentDate) {
      return t("outsource.returnDateBeforeSentDate");
    }
    const cost = Number(fields.cost);
    if (!fields.cost || Number.isNaN(cost) || cost < 0) return t("validation.amountInvalid");
    if (branches.length > 0 && !fields.branchId) return t("validation.branchRequired");
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const input = {
        relatedOrderNumber: fields.relatedOrderNumber,
        workDescription: fields.workDescription,
        vendorName: fields.vendorName,
        sentDate: fields.sentDate,
        expectedReturnDate: fields.expectedReturnDate,
        cost: Number(fields.cost),
        status: fields.status,
        branchId: fields.branchId,
      };
      if (isEdit && editingRecord) {
        await updateOutsourceRecord(tenantId, editingRecord.id, input);
      } else {
        await createOutsourceRecord(tenantId, { uid: user.uid, name: user.displayName ?? "" }, input);
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError(t("outsource.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventOutsideClose>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("outsource.editRecord") : t("outsource.newRecord")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="outsourceVendor">{t("outsource.vendorName")} *</Label>
            <Input
              id="outsourceVendor"
              value={fields.vendorName}
              onChange={(e) => update("vendorName", e.target.value)}
              placeholder={t("outsource.vendorNamePlaceholder")}
            />
          </div>

          <div>
            <Label htmlFor="outsourceWork">{t("outsource.workDescription")} *</Label>
            <Textarea
              id="outsourceWork"
              value={fields.workDescription}
              onChange={(e) => update("workDescription", e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="outsourceOrderNumber">{t("outsource.relatedOrderNumber")}</Label>
            <Input
              id="outsourceOrderNumber"
              value={fields.relatedOrderNumber}
              onChange={(e) => update("relatedOrderNumber", e.target.value)}
              placeholder={t("outsource.relatedOrderNumberPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="outsourceSentDate">{t("outsource.sentDate")} *</Label>
              <Input
                id="outsourceSentDate"
                type="date"
                value={fields.sentDate}
                onChange={(e) => update("sentDate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="outsourceReturnDate">{t("outsource.expectedReturnDate")} *</Label>
              <Input
                id="outsourceReturnDate"
                type="date"
                value={fields.expectedReturnDate}
                onChange={(e) => update("expectedReturnDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="outsourceCost">{t("outsource.cost")} *</Label>
              <Input
                id="outsourceCost"
                type="number"
                min={0}
                step="any"
                value={fields.cost}
                onChange={(e) => update("cost", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="outsourceStatus">{t("outsource.status")} *</Label>
              <select
                id="outsourceStatus"
                value={fields.status}
                onChange={(e) => update("status", e.target.value as OutsourceStatus)}
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                {OUTSOURCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`outsource.statusValue.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {branches.length > 0 && (
            <div>
              <Label htmlFor="outsourceBranch">{t("expenses.branch")} *</Label>
              <select
                id="outsourceBranch"
                value={fields.branchId}
                onChange={(e) => update("branchId", e.target.value)}
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">{t("expenses.selectBranch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
