"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Banknote, Pencil, ShoppingCart, Trash2, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { softDeleteSupplier } from "@/lib/firebase/suppliers";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatTaka } from "@/lib/utils/calculations";
import type { Supplier, SupplierTransactionType } from "@/lib/types/supplier";
import type { Branch } from "@/lib/types/dashboard";

interface SupplierListTableProps {
  tenantId: string;
  suppliers: Supplier[];
  branches: Branch[];
  isLoading: boolean;
  canManage: boolean;
  onEdit: (supplier: Supplier) => void;
  onTransaction: (supplier: Supplier, type: SupplierTransactionType) => void;
  onDeleted?: () => void;
}

export function SupplierListTable({
  tenantId,
  suppliers,
  branches,
  isLoading,
  canManage,
  onEdit,
  onTransaction,
  onDeleted,
}: SupplierListTableProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  async function confirmDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    try {
      await softDeleteSupplier(tenantId, deleteTarget.id, user.uid);
      onDeleted?.();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <Users className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("suppliers.noSuppliersFound")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">{t("suppliers.name")}</th>
                <th className="px-4 py-2.5">{t("suppliers.phone")}</th>
                <th className="px-4 py-2.5">{t("suppliers.suppliedItems")}</th>
                <th className="px-4 py-2.5">{t("suppliers.branch")}</th>
                <th className="px-4 py-2.5">{t("suppliers.currentDue")}</th>
                <th className="px-4 py-2.5 text-right">{t("suppliers.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {suppliers.map((supplier) => {
                const hasDue = supplier.currentDue > 0;
                return (
                  <tr key={supplier.id} className={hasDue ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-neutral-50"}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/suppliers/${supplier.id}`}
                        className="font-medium text-neutral-900 hover:text-brand-primary hover:underline"
                      >
                        {supplier.name}
                      </Link>
                      {supplier.contactPerson && (
                        <p className="text-xs text-neutral-400">{supplier.contactPerson}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{supplier.phone || "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-neutral-600">{supplier.suppliedItems || "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{branchNameById.get(supplier.branchId) ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">
                      {supplier.currentDue < 0 ? (
                        <span className="font-medium text-status-success">
                          {t("suppliers.advanceAmount", { amount: formatTaka(Math.abs(supplier.currentDue)) })}
                        </span>
                      ) : supplier.currentDue > 0 ? (
                        <span className="font-medium text-status-danger">{formatTaka(supplier.currentDue)}</span>
                      ) : (
                        <span className="text-neutral-400">{formatTaka(0)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title={t("suppliers.type.purchase")}
                            onClick={() => onTransaction(supplier, "purchase")}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50"
                          >
                            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("suppliers.type.payment")}
                            onClick={() => onTransaction(supplier, "payment")}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                          >
                            <Banknote className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("common.edit")}
                            onClick={() => onEdit(supplier)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("common.delete")}
                            onClick={() => setDeleteTarget(supplier)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-status-danger hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("suppliers.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("suppliers.confirmDeleteDescription", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
