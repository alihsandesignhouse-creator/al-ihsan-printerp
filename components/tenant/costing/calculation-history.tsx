"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, History as HistoryIcon, Upload } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { softDeleteCostCalculation } from "@/lib/firebase/cost-calculator";
import { formatTaka } from "@/lib/utils/calculations";
import type { CostCalculation } from "@/lib/types/cost-calculator";

interface CalculationHistoryProps {
  tenantId: string;
  userId: string;
  calculations: CostCalculation[];
  isLoading: boolean;
  onLoad: (calculation: CostCalculation) => void;
}

export function CalculationHistory({ tenantId, userId, calculations, isLoading, onLoad }: CalculationHistoryProps) {
  const t = useTranslations();
  const [deleteTarget, setDeleteTarget] = useState<CostCalculation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await softDeleteCostCalculation(tenantId, deleteTarget.id, userId);
      toast.success(t("costing.calculationDeleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("costing.saveFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <HistoryIcon className="h-4 w-4 text-neutral-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-neutral-900">{t("costing.history")}</h2>
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : calculations.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{t("costing.noHistoryYet")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100">
          {calculations.map((calc) => (
            <li key={calc.id} className="flex items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-800">{calc.name}</p>
                <p className="text-xs text-neutral-500">
                  {t("costing.totalProductionCost")}: {formatTaka(calc.totalProductionCost)} ·{" "}
                  {t("costing.suggestedPricePerPiece")}: {formatTaka(calc.suggestedSellingPricePerPiece)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onLoad(calc)}
                  title={t("costing.loadCalculation")}
                  aria-label={t("costing.loadCalculation")}
                >
                  <Upload className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(calc)}
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4 text-status-danger" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("costing.confirmDeleteCalculationTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("costing.confirmDeleteCalculationDescription", { name: deleteTarget?.name ?? "" })}
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
