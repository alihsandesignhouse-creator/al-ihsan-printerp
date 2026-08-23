"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Button } from "@/components/ui/button";
import { createStaffMember, updateStaffMember } from "@/lib/firebase/users";
import { STAFF_ROLES, type StaffMember, type StaffRole } from "@/lib/types/user";
import type { Branch } from "@/lib/types/dashboard";

const bdPhoneFreeEmail = z.string().email({ message: "validation.emailInvalid" });

const baseSchema = z.object({
  name: z.string().min(2, { message: "validation.nameRequired" }).max(80),
  email: bdPhoneFreeEmail,
  role: z.enum(["branch_manager", "commission_staff", "regular_staff"] as [
    StaffRole,
    ...StaffRole[],
  ]),
  branchId: z.string().default(""),
  commissionRate: z
    .number({ invalid_type_error: "validation.commissionInvalid" })
    .min(0, { message: "validation.commissionInvalid" })
    .max(100, { message: "validation.commissionInvalid" }),
  password: z.string().optional().default(""),
});

const createSchema = baseSchema.extend({
  password: z.string().min(8, { message: "validation.passwordMin" }),
});

type FormValues = z.infer<typeof baseSchema>;

interface StaffFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  editingStaff: StaffMember | null; // null = create mode
  onSaved: () => void;
}

export function StaffFormModal({
  open,
  onOpenChange,
  branches,
  editingStaff,
  onSaved,
}: StaffFormModalProps) {
  const t = useTranslations();
  const isEditMode = editingStaff !== null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(isEditMode ? baseSchema : createSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "regular_staff",
      branchId: "",
      commissionRate: 0,
      password: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingStaff) {
      reset({
        name: editingStaff.name,
        email: editingStaff.email,
        role: editingStaff.role,
        branchId: editingStaff.branchId ?? "",
        commissionRate: editingStaff.commissionRate ?? 0,
        password: "",
      });
    } else {
      reset({
        name: "",
        email: "",
        role: "regular_staff",
        branchId: "",
        commissionRate: 0,
        password: "",
      });
    }
  }, [open, editingStaff, reset]);

  // বাগ-ফিক্স (১৮ আগস্ট ২০২৬ লাইভ-অডিট): এক-শাখা টেন্যান্টে নতুন স্টাফ
  // তৈরির ফর্মে branch ড্রপডাউন ডিফল্ট "— শাখা নেই —" (branchId="") থেকে
  // যেত — order-form.tsx-এ আগে ফিক্স হওয়া একই প্যাটার্নের বাগ, ভিন্ন
  // ফাইলে। শুধু create mode-এ প্রযোজ্য (edit mode-এ বিদ্যমান স্টাফের
  // branchId উপরের effect-এই যথাযথভাবে সেট হয়, এখানে ছোঁয়া হয়নি)।
  useEffect(() => {
    if (!open || editingStaff) return;
    if (branches.length === 1) {
      setValue("branchId", branches[0]!.id, { shouldValidate: true });
    }
  }, [open, editingStaff, branches, setValue]);

  const getError = (key: keyof FormValues): string | null => {
    const msg = errors[key]?.message;
    return msg ? t(msg as Parameters<typeof t>[0]) : null;
  };

  async function onSubmit(values: FormValues) {
    try {
      if (isEditMode && editingStaff) {
        await updateStaffMember({
          userId: editingStaff.id,
          name: values.name.trim(),
          role: values.role,
          branchId: values.branchId || null,
          commissionRate: values.commissionRate,
          ...(values.password ? { newPassword: values.password } : {}),
        });
        toast.success(t("users.toast.updated"));
      } else {
        await createStaffMember({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          role: values.role,
          branchId: values.branchId || null,
          commissionRate: values.commissionRate,
        });
        toast.success(t("users.toast.created"));
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code.includes("resource-exhausted")) {
        toast.error(t("users.toast.limitReached"));
      } else if (code.includes("already-exists")) {
        toast.error(t("users.toast.emailExists"));
      } else {
        toast.error(t("users.toast.saveFailed"));
      }
    }
  }

  const fieldClass =
    "h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm outline-none transition-colors focus:border-brand-primary focus:ring-1 focus:ring-brand-primary";
  const labelClass = "mb-1 block text-sm font-medium text-neutral-700";
  const errorClass = "mt-1 text-xs text-status-danger";

  const role = watch("role");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventOutsideClose className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t("users.editTitle") : t("users.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? t("users.editSubtitle") : t("users.createSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div>
            <Label className={labelClass}>
              {t("users.fields.name")} <span className="text-status-danger">*</span>
            </Label>
            <input
              {...register("name")}
              placeholder={t("users.placeholders.name")}
              className={`${fieldClass} ${errors.name ? "border-status-danger" : ""}`}
            />
            {getError("name") && <p className={errorClass}>{getError("name")}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className={labelClass}>
                {t("users.fields.email")} <span className="text-status-danger">*</span>
              </Label>
              <input
                {...register("email")}
                type="email"
                disabled={isEditMode}
                placeholder={t("users.placeholders.email")}
                className={`${fieldClass} ${errors.email ? "border-status-danger" : ""} ${
                  isEditMode ? "bg-neutral-50 text-neutral-400" : ""
                }`}
              />
              {getError("email") && <p className={errorClass}>{getError("email")}</p>}
            </div>
            <div>
              <Label className={labelClass}>
                {isEditMode ? t("users.fields.newPassword") : t("users.fields.password")}
                {!isEditMode && <span className="text-status-danger"> *</span>}
              </Label>
              <input
                {...register("password")}
                type="password"
                placeholder={
                  isEditMode ? t("users.placeholders.newPassword") : t("users.placeholders.password")
                }
                className={`${fieldClass} ${errors.password ? "border-status-danger" : ""}`}
              />
              {getError("password") && <p className={errorClass}>{getError("password")}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className={labelClass}>
                {t("users.fields.role")} <span className="text-status-danger">*</span>
              </Label>
              <select
                {...register("role")}
                className={fieldClass}
                value={role}
                onChange={(e) => setValue("role", e.target.value as StaffRole)}
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`users.role.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className={labelClass}>{t("users.fields.branch")}</Label>
              <select
                {...register("branchId")}
                className={fieldClass}
                defaultValue={editingStaff?.branchId ?? ""}
              >
                <option value="">{t("users.allBranches")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label className={labelClass}>{t("users.fields.commissionRate")}</Label>
            <input
              {...register("commissionRate", { valueAsNumber: true })}
              type="number"
              step="0.5"
              min={0}
              max={100}
              placeholder="0"
              className={`${fieldClass} ${errors.commissionRate ? "border-status-danger" : ""}`}
            />
            {getError("commissionRate") && (
              <p className={errorClass}>{getError("commissionRate")}</p>
            )}
          </div>

          <DialogFooter className="border-t border-neutral-100 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
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
