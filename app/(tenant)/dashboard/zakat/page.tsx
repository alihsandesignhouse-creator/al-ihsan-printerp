"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { HandHeart, Plus, Printer, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeActiveZakatYear, subscribeZakatYearHistory, subscribeZakatPayments } from "@/lib/firebase/zakat";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { ZakatYearStartDialog } from "@/components/tenant/zakat/zakat-year-start-dialog";
import { BusinessAssetsForm } from "@/components/tenant/zakat/business-assets-form";
import { ZakatSummaryCard } from "@/components/tenant/zakat/zakat-summary-card";
import { ZakatDistributionSection } from "@/components/tenant/zakat/zakat-distribution-section";
import { ZakatYearHistoryList } from "@/components/tenant/zakat/zakat-year-history-list";
import { Button } from "@/components/ui/button";
import type { ZakatYear, ZakatPayment } from "@/lib/types/zakat";

/**
 * Module ZK-01/ZK-02 — যাকাত মডিউল (blueprint অংশ ১০)। শুধু Tenant Admin-এর
 * ব্যক্তিগত ব্যবহারের জন্য, ব্যবসায়িক রিপোর্ট থেকে সম্পূর্ণ আলাদা।
 *
 * এই সেশনের সিদ্ধান্ত: একটি একক "সক্রিয় Hawl বছর" মডেল — একই সময়ে সর্বোচ্চ
 * ১টি সক্রিয় বছর থাকে, সম্পন্ন হলে ইতিহাসে চলে যায়। আলাদা প্রিন্ট-ভিউ
 * ডকুমেন্ট (চালান/কোটেশনের মতো) তৈরি না করে সরাসরি এই পেজ প্রিন্ট করা হয়
 * (window.print(), T-18 রিপোর্ট পেজের কনভেনশন অনুসরণ করে) — ব্যক্তিগত বার্ষিক
 * সারসংক্ষেপের জন্য এটি যথেষ্ট এবং একটি ডুপ্লিকেট ডকুমেন্ট রেন্ডারার এড়ায়।
 */
export default function ZakatPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const uid = user?.uid ?? null;
  const handleFirestoreError = useFirestoreErrorHandler();

  const [activeYear, setActiveYear] = useState<ZakatYear | null>(null);
  const [activeYearLoaded, setActiveYearLoaded] = useState(false);
  const [history, setHistory] = useState<ZakatYear[]>([]);
  const [payments, setPayments] = useState<ZakatPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [startDialogOpen, setStartDialogOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeActiveZakatYear(
      tenantId,
      (year) => {
        setActiveYear(year);
        setActiveYearLoaded(true);
      },
      handleFirestoreError(() => setActiveYearLoaded(true))
    );
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeZakatYearHistory(tenantId, setHistory, handleFirestoreError());
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !activeYear) {
      setPayments([]);
      return;
    }
    setPaymentsLoading(true);
    const unsub = subscribeZakatPayments(
      tenantId,
      activeYear.id,
      (data) => {
        setPayments(data);
        setPaymentsLoading(false);
      },
      handleFirestoreError(() => setPaymentsLoading(false))
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, activeYear?.id]);

  if (!tenantId || !uid) return null;

  const hawlEndPassed = activeYear ? activeYear.hawlEnd.toDate() < new Date() : false;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <HandHeart className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-neutral-900">{t("zakat.pageTitle")}</h1>
        </div>
        {activeYear && (
          <div data-print-hide>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t("common.print")}
            </Button>
          </div>
        )}
      </div>

      {!activeYearLoaded ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      ) : !activeYear ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-14 text-center">
          <HandHeart className="h-9 w-9 text-neutral-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-neutral-700">{t("zakat.noActiveYear")}</p>
            <p className="mt-1 text-sm text-neutral-400">{t("zakat.noActiveYearHint")}</p>
          </div>
          <Button type="button" onClick={() => setStartDialogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("zakat.startNewYear")}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {hawlEndPassed && (
            <div data-print-hide className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t("zakat.hawlEndedReminder")}
            </div>
          )}

          <ZakatSummaryCard tenantId={tenantId} year={activeYear} onCompleted={() => setActiveYear(null)} />
          <BusinessAssetsForm tenantId={tenantId} year={activeYear} onSaved={() => undefined} />
          <ZakatDistributionSection
            tenantId={tenantId}
            actorUid={uid}
            year={activeYear}
            payments={payments}
            isLoading={paymentsLoading}
          />
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <ZakatYearHistoryList years={history} />
        </div>
      )}

      <ZakatYearStartDialog
        tenantId={tenantId}
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        onCreated={() => undefined}
      />
    </div>
  );
}
