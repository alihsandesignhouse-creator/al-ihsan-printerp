"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { branchFormSchema, type BranchFormValues } from "@/lib/validations/branch";
import { createBranch, updateBranch } from "@/lib/firebase/branches";
import { subscribeStaffMembers } from "@/lib/firebase/users";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import type { Branch } from "@/lib/types/dashboard";
import type { StaffMember } from "@/lib/types/user";

interface BranchFormModalProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null; // null = create mode
}

export function BranchFormModal({ tenantId, open, onOpenChange, branch }: BranchFormModalProps) {
  const t = useTranslations();
  const handleFirestoreError = useFirestoreErrorHandler();
  const [managers, setManagers] = useState<StaffMember[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: { name: "", address: "", phone: "", branchManagerId: "", isActive: true },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      branch
        ? {
            name: branch.name,
            address: branch.address,
            phone: branch.phone ?? "",
            branchManagerId: branch.branchManagerId ?? "",
            isActive: branch.isActive,
          }
        : { name: "", address: "", phone: "", branchManagerId: "", isActive: true }
    );
  }, [open, branch, reset]);

  useEffect(() => {
    if (!open) return;
    const unsub = subscribeStaffMembers(
      tenantId,
      "all",
      (staff) => setManagers(staff.filter((s) => s.role === "branch_manager" && s.isActive)),
      handleFirestoreError(() => setManagers([]))
    );
    return unsub;
  }, [open, tenantId, handleFirestoreError]);

  async function onSubmit(values: BranchFormValues) {
    try {
      if (branch) {
        await updateBranch(tenantId, branch.id, values);
        toast.success(t("settings.branch.updated"));
      } else {
        await createBranch(tenantId, values);
        toast.success(t("settings.branch.created"));
      }
      onOpenChange(false);
    } catch (err) {
      // AUDIT-REPORT-5 Issue #2 fix: createBranch() now calls
      // app/api/branches/create, which returns code "resource-exhausted"
      // once the plan's branch limit is reached — mirrors
      // staff-form-modal.tsx's identical check for the staff limit.
      const code = (err as { code?: string })?.code ?? "";
      if (code.includes("resource-exhausted")) {
        toast.error(t("settings.branch.limitReached"));
      } else {
        toast.error(t("settings.branch.saveFailed"));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventOutsideClose>
        <DialogHeader>
          <DialogTitle>
            {branch ? t("settings.branch.editTitle") : t("settings.branch.createTitle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("settings.branch.name")}
            </Label>
            <Input {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.name.message ?? "")}</p>
            )}
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("settings.branch.address")}
            </Label>
            <Input {...register("address")} aria-invalid={!!errors.address} />
            {errors.address && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.address.message ?? "")}</p>
            )}
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("settings.branch.phone")}
            </Label>
            <Input {...register("phone")} aria-invalid={!!errors.phone} placeholder="01XXXXXXXXX" />
            {errors.phone && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.phone.message ?? "")}</p>
            )}
          </div>

          <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
              {t("settings.branch.manager")}
            </Label>
            <Select
              value={watch("branchManagerId") || "none"}
              onValueChange={(v) => setValue("branchManagerId", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("settings.branch.managerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("settings.branch.noManager")}</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
            <Label className="text-sm font-medium text-neutral-700">
              {t("settings.branch.active")}
            </Label>
            <Switch
              checked={watch("isActive")}
              onCheckedChange={(v) => setValue("isActive", v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
