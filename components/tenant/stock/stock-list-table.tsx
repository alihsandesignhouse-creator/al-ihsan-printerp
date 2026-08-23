"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  PackageX,
  Pencil,
  Trash2,
} from "lucide-react";
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
import { softDeleteStockItem } from "@/lib/firebase/stock";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { StockItem } from "@/lib/types/stock";
import type { Branch } from "@/lib/types/dashboard";

interface StockListTableProps {
  tenantId: string;
  items: StockItem[];
  branches: Branch[];
  isLoading: boolean;
  canManage: boolean;
  onEdit: (item: StockItem) => void;
  onTransaction: (item: StockItem, type: "in" | "out") => void;
  onDeleted?: () => void;
}

export function StockListTable({
  tenantId,
  items,
  branches,
  isLoading,
  canManage,
  onEdit,
  onTransaction,
  onDeleted,
}: StockListTableProps) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  async function confirmDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    try {
      await softDeleteStockItem(tenantId, deleteTarget.id, user.uid);
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

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <PackageX className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("stock.noItemsFound")}</p>
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
                <th className="px-4 py-2.5">{t("stock.itemName")}</th>
                <th className="px-4 py-2.5">{t("stock.category")}</th>
                <th className="px-4 py-2.5">{t("stock.branch")}</th>
                <th className="px-4 py-2.5">{t("stock.currentStock")}</th>
                <th className="px-4 py-2.5">{t("stock.minimumLevel")}</th>
                <th className="px-4 py-2.5">{t("stock.statusColumn")}</th>
                <th className="px-4 py-2.5 text-right">{t("stock.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item) => {
                const isLow = item.currentStock <= item.minimumLevel;
                return (
                  <tr key={item.id} className={isLow ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-neutral-50"}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/stock/${item.id}`}
                        className="font-medium text-neutral-900 hover:text-brand-primary hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{item.category || "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{branchNameById.get(item.branchId) ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">
                      <span className={isLow ? "font-medium text-status-danger" : "text-neutral-900"}>
                        {item.currentStock}
                      </span>{" "}
                      <span className="text-xs text-neutral-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-500">
                      {item.minimumLevel} <span className="text-xs text-neutral-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          {t("stock.statusLow")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                          {t("stock.statusNormal")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title={t("stock.type.in")}
                            onClick={() => onTransaction(item, "in")}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                          >
                            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("stock.type.out")}
                            onClick={() => onTransaction(item, "out")}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50"
                          >
                            <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("common.edit")}
                            onClick={() => onEdit(item)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("common.delete")}
                            onClick={() => setDeleteTarget(item)}
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
            <AlertDialogTitle>{t("stock.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("stock.confirmDeleteDescription", { name: deleteTarget?.name ?? "" })}
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
