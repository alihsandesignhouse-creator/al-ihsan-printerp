"use client";

import { useTranslations } from "next-intl";
import { QuotationForm } from "@/components/tenant/quotations/quotation-form";

export default function NewQuotationPage() {
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-neutral-900">{t("quotations.newQuotationTitle")}</h1>
      <QuotationForm />
    </div>
  );
}
