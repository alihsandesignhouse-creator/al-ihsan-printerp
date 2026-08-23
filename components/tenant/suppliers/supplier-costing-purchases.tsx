"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Link2, Loader2, PackageSearch, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTaka } from "@/lib/utils/calculations";
import { formatDateLocalized } from "@/lib/utils/format";
import type { OrderCosting } from "@/lib/types/order-costing";

interface SupplierCostingPurchasesProps {
  costings: OrderCosting[];
  isLoading: boolean;
  canManage: boolean;
  linkingOrderId: string | null;
  onLink: (costing: OrderCosting) => void;
}

/**
 * সাপ্লায়ার প্রোফাইল পেজে "কস্টিং থেকে ক্রয়" ট্যাব — T-11 অর্ডার কস্টিং-এ এই
 * সাপ্লায়ার ট্যাগ করা প্রতিটা এন্ট্রি এখানে তালিকাভুক্ত হয়, যাতে "কার থেকে
 * কত টাকার মাল নেওয়া হয়েছে" পুরো বিস্তারিত হিসাব এক জায়গায় দেখা যায় —
 * ম্যানুয়ালি লেজারে যোগ করা (ShoppingCart আইকন) ও এখনো না-যোগ করা উভয় ধরনের
 * এন্ট্রিই দেখানো হয়, যাতে reconciliation স্পষ্ট থাকে (১৬ আগস্ট ২০২৬)।
 */
export function SupplierCostingPurchases({
  costings,
  isLoading,
  canManage,
  linkingOrderId,
  onLink,
}: SupplierCostingPurchasesProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (costings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <PackageSearch className="h-7 w-7 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("suppliers.noCostingPurchasesFound")}</p>
      </div>
    );
  }

  const totalTagged = costings.reduce((sum, c) => sum + c.rawMaterialCost, 0);
  const totalLinked = costings
    .filter((c) => c.supplierTransactionId)
    .reduce((sum, c) => sum + c.rawMaterialCost, 0);
  const totalUnlinked = totalTagged - totalLinked;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-xs text-neutral-500">{t("suppliers.totalTaggedFromCosting")}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-900">{formatTaka(totalTagged)}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">{t("suppliers.totalLinkedToLedger")}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-700">{formatTaka(totalLinked)}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-3">
          <p className="text-xs text-amber-700">{t("suppliers.totalNotYetLinked")}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-amber-700">{formatTaka(totalUnlinked)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">{t("orders.orderNumber")}</th>
                <th className="px-4 py-2.5">{t("suppliers.dateTime")}</th>
                <th className="px-4 py-2.5">{t("orderCosting.rawMaterialCost")}</th>
                <th className="px-4 py-2.5">{t("suppliers.ledgerStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {costings.map((c) => {
                const date = c.createdAt?.toDate?.();
                const isLinking = linkingOrderId === c.orderId;
                return (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/orders/${c.orderId}`}
                        className="font-medium text-brand-primary hover:underline"
                      >
                        {c.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{date ? formatDateLocalized(date, locale) : "—"}</td>
                    <td className="px-4 py-3 font-mono font-medium text-neutral-900">
                      {formatTaka(c.rawMaterialCost)}
                    </td>
                    <td className="px-4 py-3">
                      {c.supplierTransactionId ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                          <Link2 className="h-3 w-3" aria-hidden="true" />
                          {t("orderCosting.supplierLedgerLinked")}
                        </span>
                      ) : canManage ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => onLink(c)} disabled={isLinking}>
                          {isLinking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {t("orderCosting.addToSupplierLedger")}
                        </Button>
                      ) : (
                        <span className="text-xs text-neutral-400">{t("suppliers.notYetLinked")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
