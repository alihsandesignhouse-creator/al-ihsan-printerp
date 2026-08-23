"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { markZakatYearCompleted } from "@/lib/firebase/zakat";
import { isBelowNisab } from "@/lib/utils/zakat-math";
import { formatTaka } from "@/lib/utils/calculations";
import type { ZakatYear } from "@/lib/types/zakat";

interface ZakatSummaryCardProps {
  tenantId: string;
  year: ZakatYear;
  onCompleted: () => void;
}

/** blueprint ZK-01/ZK-02: "যাকাত Dashboard: মোট প্রদেয় | পরিশোধিত | অবশিষ্ট [Progress Bar]"। */
export function ZakatSummaryCard({ tenantId, year, onCompleted }: ZakatSummaryCardProps) {
  const t = useTranslations();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const belowNisab = isBelowNisab(year.netZakatableAssets, year.nisabAmount);
  const remaining = Math.max(0, year.zakatDue - year.zakatPaid);
  const progressPercent = year.zakatDue > 0 ? Math.min(100, Math.round((year.zakatPaid / year.zakatDue) * 100)) : 0;

  async function handleComplete() {
    setIsCompleting(true);
    try {
      await markZakatYearCompleted(tenantId, year.id);
      toast.success(t("zakat.yearCompleted"));
      setConfirmOpen(false);
      onCompleted();
    } catch {
      toast.error(t("zakat.saveFailed"));
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{t("zakat.summaryTitle")}</h2>
        <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
          {t("zakat.hijriYearLabel", { year: year.hijriYear })}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-neutral-500">{t("zakat.netZakatableAssets")}</p>
          <p className="mt-0.5 font-mono text-base font-semibold text-neutral-900">
            {formatTaka(year.netZakatableAssets)}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">{t("zakat.nisabAmount")}</p>
          <p className="mt-0.5 font-mono text-base font-semibold text-neutral-900">{formatTaka(year.nisabAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">{t("zakat.zakatDue")}</p>
          <p className="mt-0.5 font-mono text-base font-semibold text-brand-primary">{formatTaka(year.zakatDue)}</p>
        </div>
      </div>

      {belowNisab && year.nisabAmount > 0 && (
        <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">{t("zakat.belowNisabNotice")}</p>
      )}

      {year.zakatDue > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-neutral-500">
            <span>
              {t("zakat.paid")}: {formatTaka(year.zakatPaid)}
            </span>
            <span>
              {t("zakat.remaining")}: {formatTaka(remaining)}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {year.status === "active" && (
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t("zakat.markCompleted")}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("zakat.confirmCompleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("zakat.confirmCompleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} disabled={isCompleting}>
              {isCompleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("zakat.markCompleted")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
