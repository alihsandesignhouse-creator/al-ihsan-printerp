"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Phone, CreditCard, Printer, AlertCircle, PackageCheck } from "lucide-react";
import type { DeliveryHighlight } from "@/lib/types/dashboard";
import { formatTaka } from "@/lib/utils/calculations";

interface DeliverySectionProps {
  title: string;
  deliveries: DeliveryHighlight[];
  emptyMessage: string;
  isLoading?: boolean;
}

function DeliveryRowSkeleton() {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 last:border-b-0">
      <div className="space-y-1.5">
        <div className="h-3.5 w-32 animate-pulse rounded bg-neutral-100" />
        <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="h-8 w-24 animate-pulse rounded bg-neutral-100" />
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: DeliveryHighlight }) {
  const t = useTranslations();
  const telHref = `tel:${delivery.customerPhone}`;

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {delivery.isUrgent && (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
          )}
          <p className="truncate text-sm font-medium text-neutral-900">
            {delivery.customerName}
            <span className="ml-1.5 font-mono text-xs text-neutral-400">{delivery.orderNumber}</span>
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {delivery.itemSummary} &middot; {t("dashboard.dueAmount")}: {formatTaka(delivery.dueAmount)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <a
          href={telHref}
          title={t("dashboard.viewOrder")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
        </a>
        <Link
          href={`/dashboard/orders/${delivery.orderId}?action=payment`}
          title={t("dashboard.recordPayment")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href={`/dashboard/orders/${delivery.orderId}?action=print`}
          title={t("dashboard.printChallan")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function DeliverySection({
  title,
  deliveries,
  emptyMessage,
  isLoading = false,
}: DeliverySectionProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      </div>
      {isLoading ? (
        <div>
          <DeliveryRowSkeleton />
          <DeliveryRowSkeleton />
        </div>
      ) : deliveries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <PackageCheck className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="text-sm text-neutral-400">{emptyMessage}</p>
        </div>
      ) : (
        <div>
          {deliveries.map((delivery) => (
            <DeliveryRow key={delivery.orderId} delivery={delivery} />
          ))}
        </div>
      )}
    </div>
  );
}
