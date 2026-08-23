"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Package, Layers } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import { DeleteItemDialog } from "./delete-item-dialog";
import type { ItemMasterEntry } from "@/lib/types/order";

interface ItemListTableProps {
  tenantId: string;
  userId: string;
  items: ItemMasterEntry[];
  isLoading: boolean;
  canManage: boolean;
  onEdit: (item: ItemMasterEntry) => void;
}

export function ItemListTable({ tenantId, userId, items, isLoading, canManage, onEdit }: ItemListTableProps) {
  const t = useTranslations();
  const [deleteTarget, setDeleteTarget] = useState<ItemMasterEntry | null>(null);

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
        <Package className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("itemMaster.noItemsFound")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">{t("itemMaster.name")}</th>
                <th className="px-4 py-2.5 text-right">{t("itemMaster.defaultUnitPrice")}</th>
                {canManage && <th className="px-4 py-2.5 text-right">{t("itemMaster.actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    <div className="flex items-center gap-2">
                      {item.name}
                      {item.attributeGroups && item.attributeGroups.length > 0 && (
                        <span
                          title={t("itemMaster.attributeGroups")}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700"
                        >
                          <Layers className="h-3 w-3" aria-hidden="true" />
                          {item.attributeGroups.length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-neutral-900">
                    {formatTaka(item.defaultUnitPrice)}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title={t("common.edit")}
                          aria-label={t("common.edit")}
                          onClick={() => onEdit(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={t("common.delete")}
                          aria-label={t("common.delete")}
                          onClick={() => setDeleteTarget(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-status-danger hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteItemDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        tenantId={tenantId}
        userId={userId}
        item={deleteTarget}
      />
    </>
  );
}
