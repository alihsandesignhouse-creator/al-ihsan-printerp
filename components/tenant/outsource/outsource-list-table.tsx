"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDateLocalized } from "@/lib/utils/format";
import { Pencil, Trash2, ExternalLink, AlertCircle } from "lucide-react";
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
import { softDeleteOutsourceRecord } from "@/lib/firebase/outsource";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatTaka } from "@/lib/utils/calculations";
import type { OutsourceRecord } from "@/lib/types/outsource";
import type { Branch } from "@/lib/types/dashboard";
import { OUTSOURCE_STATUS_CLASSES } from "@/lib/constants/status-colors";

function formatDate(ts: { toDate?: () => Date } | null | undefined, locale: string): string {
  const date = ts?.toDate?.();
  if (!date) return "—";
  return formatDateLocalized(date, locale);
}

/** আজকের তারিখ পেরিয়ে গেছে কিন্তু এখনো "ফেরত" স্ট্যাটাসে পৌঁছায়নি — blueprint T-03-এর "মেয়াদ পেরিয়ে গেলে স্বয়ংক্রিয় লাল হাইলাইট" নীতি এখানেও প্রয়োগ করা। */
function isOverdue(record: OutsourceRecord): boolean {
  if (record.status === "returned") return false;
  const due = record.expectedReturnDate?.toDate?.();
  if (!due) return false;
  return due < new Date();
}

interface OutsourceListTableProps {
  tenantId: string;
  records: OutsourceRecord[];
  branches: Branch[];
  isLoading: boolean;
  canManage: boolean;
  onEdit: (record: OutsourceRecord) => void;
  onDeleted?: () => void;
}

export function OutsourceListTable({
  tenantId,
  records,
  branches,
  isLoading,
  canManage,
  onEdit,
  onDeleted,
}: OutsourceListTableProps) {
  const t = useTranslations();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const [deleteTarget, setDeleteTarget] = useState<OutsourceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  async function confirmDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    try {
      await softDeleteOutsourceRecord(tenantId, deleteTarget.id, user.uid);
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

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <ExternalLink className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("outsource.noRecordsFound")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">{t("outsource.vendorName")}</th>
                <th className="px-4 py-2.5">{t("outsource.workDescription")}</th>
                <th className="px-4 py-2.5">{t("outsource.relatedOrderNumber")}</th>
                <th className="px-4 py-2.5">{t("outsource.sentDate")}</th>
                <th className="px-4 py-2.5">{t("outsource.expectedReturnDate")}</th>
                <th className="px-4 py-2.5">{t("expenses.branch")}</th>
                <th className="px-4 py-2.5">{t("outsource.status")}</th>
                <th className="px-4 py-2.5 text-right">{t("outsource.cost")}</th>
                <th className="px-4 py-2.5 text-right">{t("expenses.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {records.map((record) => {
                const overdue = isOverdue(record);
                return (
                  <tr key={record.id} className={overdue ? "bg-red-50 hover:bg-red-100" : "hover:bg-neutral-50"}>
                    <td className="px-4 py-3 font-medium text-neutral-800">{record.vendorName}</td>
                    <td className="px-4 py-3 text-neutral-600">{record.workDescription}</td>
                    <td className="px-4 py-3 font-mono text-neutral-600">{record.relatedOrderNumber || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                      {formatDate(record.sentDate, locale)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {overdue && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-status-danger" aria-hidden="true" />}
                        <span className={overdue ? "font-medium text-status-danger" : "text-neutral-600"}>
                          {formatDate(record.expectedReturnDate, locale)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{branchNameById.get(record.branchId) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${OUTSOURCE_STATUS_CLASSES[record.status]}`}>
                        {t(`outsource.statusValue.${record.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-neutral-900">
                      {formatTaka(record.cost)}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title={t("common.edit")}
                            onClick={() => onEdit(record)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("common.delete")}
                            onClick={() => setDeleteTarget(record)}
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
            <AlertDialogTitle>{t("outsource.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("outsource.confirmDeleteDescription", { vendorName: deleteTarget?.vendorName ?? "" })}
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
