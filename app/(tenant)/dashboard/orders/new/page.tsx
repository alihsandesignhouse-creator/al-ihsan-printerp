"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { OrderForm } from "@/components/tenant/orders/order-form";

export default function NewOrderPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const fromQuotation = searchParams.get("fromQuotation") ?? undefined;
  const fromCustomerId = searchParams.get("customerId") ?? undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-neutral-900">{t("orders.newOrderTitle")}</h1>
      <OrderForm prefillQuotationId={fromQuotation} prefillCustomerId={fromCustomerId} />
    </div>
  );
}
