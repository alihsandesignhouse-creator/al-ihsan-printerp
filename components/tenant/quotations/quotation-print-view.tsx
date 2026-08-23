"use client";

import { useTranslations, useLocale } from "next-intl";
import { Printer } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import type { Quotation, QuotationItem } from "@/lib/types/quotation";
import type { Branch } from "@/lib/types/dashboard";
import { formatDateLocalized } from "@/lib/utils/format";

interface TenantBrandInfo {
  name: string;
  logoUrl: string;
  address: string;
}

interface QuotationPrintViewProps {
  quotation: Quotation;
  items: QuotationItem[];
  branch: Branch | null;
  tenant: TenantBrandInfo;
}

function formatDate(value: { toDate?: () => Date } | null | undefined, locale: string): string {
  const date = value?.toDate?.();
  if (!date) return "";
  return formatDateLocalized(date, locale, { day: "numeric", month: "long", year: "numeric" });
}

export function QuotationPrintView({ quotation, items, branch, tenant }: QuotationPrintViewProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div>
      <div className="mb-4 flex justify-end" data-print-hide>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("quotations.printAction")}
        </button>
      </div>

      <div data-print-content className="mx-auto max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 print:max-w-none print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-3">
            {tenant.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={tenant.name} className="h-12 w-12 rounded object-contain" />
            )}
            <div>
              <h1 className="text-lg font-semibold">{tenant.name}</h1>
              {branch && <p className="text-sm text-neutral-500">{branch.name}</p>}
              <p className="text-xs text-neutral-400">{branch?.address || tenant.address}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-brand-primary">{t("quotations.printTitle")}</p>
            <p className="font-mono text-sm">{quotation.quotationNumber}</p>
            <p className="text-xs text-neutral-400">
              {t("quotations.issueDate")}: {formatDate(quotation.createdAt, locale)}
            </p>
            <p className="text-xs text-neutral-400">
              {t("quotations.validUntil")}: {formatDate(quotation.validUntil, locale)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase text-neutral-400">{t("quotations.recipient")}</p>
            <p className="font-medium">{quotation.recipientName}</p>
            {quotation.recipientCompany && <p className="text-neutral-600">{quotation.recipientCompany}</p>}
            <p className="text-neutral-500">{quotation.recipientPhone}</p>
          </div>
        </div>

        {/* AUDIT-REPORT-5 Issue #4 fix: shown as an on-screen preview (not
            just via window.print()), so needs its own horizontal scroll
            container on narrow screens — print:overflow-visible keeps the
            actual printed page unaffected. */}
        <div className="overflow-x-auto print:overflow-visible">
        <table className="mt-4 w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs font-semibold uppercase text-neutral-500">
              <th className="py-2">{t("quotations.itemName")}</th>
              <th className="py-2 text-right">{t("quotations.quantity")}</th>
              <th className="py-2 text-right">{t("quotations.unitPrice")}</th>
              <th className="py-2 text-right">{t("quotations.lineTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100">
                <td className="py-2">
                  {item.itemName}
                  {item.description && <p className="text-xs text-neutral-400">{item.description}</p>}
                  {item.selectedAttributes && item.selectedAttributes.length > 0 && (
                    <p className="text-xs text-neutral-400">
                      {item.selectedAttributes.map((a) => `${a.groupName}: ${a.optionLabel}`).join(" · ")}
                    </p>
                  )}
                </td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatTaka(item.unitPrice)}</td>
                <td className="py-2 text-right font-medium">{formatTaka(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold">
            <span>{t("quotations.totalAmount")}</span>
            <span>{formatTaka(quotation.totalAmount)}</span>
          </div>
        </div>

        {quotation.terms && (
          <div className="mt-5 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
            <p className="mb-1 font-semibold uppercase text-neutral-400">{t("quotations.terms")}</p>
            <p className="whitespace-pre-line">{quotation.terms}</p>
          </div>
        )}

        {quotation.notes && (
          <div className="mt-3 text-xs text-neutral-500">
            <p className="whitespace-pre-line">{quotation.notes}</p>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-neutral-500">
          <div className="border-t border-neutral-300 pt-1">{t("quotations.customerSignature")}</div>
          <div className="border-t border-neutral-300 pt-1">{t("quotations.authoritySignature")}</div>
        </div>
      </div>
    </div>
  );
}
