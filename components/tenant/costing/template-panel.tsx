"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { softDeleteCostTemplate } from "@/lib/firebase/cost-calculator";
import type { CostTemplate } from "@/lib/types/cost-calculator";

interface TemplatePanelProps {
  tenantId: string;
  userId: string;
  templates: CostTemplate[];
  onLoad: (template: CostTemplate) => void;
}

export function TemplatePanel({ tenantId, userId, templates, onLoad }: TemplatePanelProps) {
  const t = useTranslations();
  const [selectedId, setSelectedId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CostTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  function handleLoad(id: string) {
    setSelectedId(id);
    const template = templates.find((tpl) => tpl.id === id);
    if (template) onLoad(template);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await softDeleteCostTemplate(tenantId, deleteTarget.id, userId);
      if (selectedId === deleteTarget.id) setSelectedId("");
      toast.success(t("costing.templateDeleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("costing.saveFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{t("costing.templates")}</h2>
        {templates.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setManageOpen((v) => !v)}>
            {manageOpen ? t("common.close") : t("costing.manageTemplates")}
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{t("costing.noTemplatesYet")}</p>
      ) : (
        <div className="mt-3">
          <select
            value={selectedId}
            onChange={(e) => handleLoad(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="">{t("costing.selectTemplate")}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({tpl.categories.length})
              </option>
            ))}
          </select>
        </div>
      )}

      {manageOpen && (
        <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
          {templates.map((tpl) => (
            <li key={tpl.id} className="flex items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-2 text-sm text-neutral-700">
                <FolderOpen className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                <span>{tpl.name}</span>
                <span className="text-xs text-neutral-400">
                  {t("costing.categoriesCount", { count: tpl.categories.length })}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(tpl)}
                title={t("common.delete")}
                aria-label={t("common.delete")}
              >
                <Trash2 className="h-4 w-4 text-status-danger" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("costing.confirmDeleteTemplateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("costing.confirmDeleteTemplateDescription", { name: deleteTarget?.name ?? "" })}
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
    </div>
  );
}
