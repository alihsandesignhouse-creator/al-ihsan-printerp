"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Plus, HeartHandshake } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { ZakatPaymentDialog } from "@/components/tenant/zakat/zakat-payment-dialog";
import { computeZakatCategoryBreakdown } from "@/lib/utils/zakat-math";
import { formatTaka } from "@/lib/utils/calculations";
import { formatDateLocalized } from "@/lib/utils/format";
import { CHART_PALETTE } from "@/lib/constants/chart-colors";
import type { ZakatYear, ZakatPayment } from "@/lib/types/zakat";

interface ZakatDistributionSectionProps {
  tenantId: string;
  actorUid: string;
  year: ZakatYear;
  payments: ZakatPayment[];
  isLoading: boolean;
}

function formatDate(payment: ZakatPayment, locale: string): string {
  const date = payment.date?.toDate?.();
  if (!date) return "";
  return formatDateLocalized(date, locale);
}

/** blueprint ZK-02: "যাকাত বিতরণ ... খাতওয়ারি Pie Chart"। */
export function ZakatDistributionSection({ tenantId, actorUid, year, payments, isLoading }: ZakatDistributionSectionProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [dialogOpen, setDialogOpen] = useState(false);

  const breakdown = computeZakatCategoryBreakdown(payments);
  const pieData = breakdown.map((slice) => ({ name: t(`zakat.categoryName.${slice.category}`), value: slice.amount }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{t("zakat.distributionTitle")}</h2>
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("zakat.recordDistribution")}
        </Button>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
          <HeartHandshake className="h-7 w-7 text-neutral-300" aria-hidden="true" />
          <p className="text-sm text-neutral-400">{t("zakat.noPaymentsYet")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-neutral-900">{t("zakat.categoryBreakdown")}</h3>
            <div className="mt-2 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }} formatter={(v: number) => [formatTaka(v), ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1">
              {breakdown.map((slice, i) => (
                <li key={slice.category} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-neutral-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                    {t(`zakat.categoryName.${slice.category}`)}
                  </span>
                  <span className="font-mono text-neutral-500">
                    {formatTaka(slice.amount)} ({slice.percentage}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {/* AUDIT-REPORT-5 Issue #4 fix: overflow-x-auto added alongside
                the existing vertical scroll so this table doesn't clip
                horizontally on narrow (mobile) screens. */}
            <div className="max-h-[340px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="sticky top-0 border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">{t("zakat.paymentDate")}</th>
                    <th className="px-3 py-2">{t("zakat.category")}</th>
                    <th className="px-3 py-2">{t("zakat.recipientName")}</th>
                    <th className="px-3 py-2 text-right">{t("zakat.amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-3 py-2 text-neutral-600">{formatDate(payment, locale)}</td>
                      <td className="px-3 py-2 text-neutral-700">{t(`zakat.categoryName.${payment.category}`)}</td>
                      <td className="px-3 py-2 text-neutral-500">{payment.recipientName || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-900">{formatTaka(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ZakatPaymentDialog
        tenantId={tenantId}
        zakatYearId={year.id}
        hijriYear={year.hijriYear}
        actorUid={actorUid}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRecorded={() => setDialogOpen(false)}
      />
    </div>
  );
}
