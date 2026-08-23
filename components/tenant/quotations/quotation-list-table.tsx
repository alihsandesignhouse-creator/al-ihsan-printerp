"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Clock, FileX2, ArrowUpRight } from "lucide-react";
import { QuotationStatusControl } from "./quotation-status-control";
import { formatTaka } from "@/lib/utils/calculations";
import type { Quotation } from "@/lib/types/quotation";
import { formatDateLocalized } from "@/lib/utils/format";

interface QuotationListTableProps {
  tenantId: string;
  quotations: Quotation[];
  isLoading: boolean;
}

function formatDate(value: { toDate?: () => Date } | null | undefined, locale: string): string {
  const date = value?.toDate?.();
  if (!date) return "";
  return formatDateLocalized(date, locale, { day: "numeric", month: "short", year: "numeric" });
}

function isPastValidity(quotation: Quotation): boolean {
  const date = quotation.validUntil?.toDate?.();
  if (!date) return false;
  if (quotation.status !== "draft" && quotation.status !== "sent") return false;
  return date < new Date();
}

export function QuotationListTable({ tenantId, quotations, isLoading }: QuotationListTableProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (quotations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <FileX2 className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("quotations.noQuotationsFound")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("quotations.quotationNumber")}</th>
              <th className="px-4 py-2.5">{t("quotations.recipient")}</th>
              <th className="px-4 py-2.5">{t("quotations.items")}</th>
              <th className="px-4 py-2.5">{t("quotations.validUntil")}</th>
              <th className="px-4 py-2.5">{t("quotations.totalAmount")}</th>
              <th className="px-4 py-2.5">{t("quotations.statusColumn")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {quotations.map((quotation) => {
              const overdue = isPastValidity(quotation);
              return (
                <tr key={quotation.id} className={overdue ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-neutral-50"}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/quotations/${quotation.id}`}
                      className="font-mono text-xs font-medium text-brand-primary hover:underline"
                    >
                      {quotation.quotationNumber}
                    </Link>
                    {quotation.quotationNumber.startsWith("OFFLINE-") && (
                      <Clock className="ml-1.5 inline-block h-3 w-3 text-neutral-400" aria-hidden="true" />
                    )}
                    {quotation.convertedToOrderId && (
                      <Link
                        href={`/dashboard/orders/${quotation.convertedToOrderId}`}
                        className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-status-success hover:underline"
                        title={t("quotations.convertedToOrder")}
                      >
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/quotations/${quotation.id}`} className="font-medium text-neutral-900 hover:underline">
                      {quotation.recipientName || t("quotations.noRecipientName")}
                    </Link>
                    <p className="text-xs text-neutral-400">
                      {[quotation.recipientCompany, quotation.recipientPhone].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-neutral-600">{quotation.itemSummary}</td>
                  <td className={`px-4 py-3 ${overdue ? "font-medium text-status-warning" : "text-neutral-600"}`}>
                    {formatDate(quotation.validUntil, locale)}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-neutral-900">
                    {formatTaka(quotation.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <QuotationStatusControl
                      tenantId={tenantId}
                      quotationId={quotation.id}
                      currentStatus={quotation.status}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
