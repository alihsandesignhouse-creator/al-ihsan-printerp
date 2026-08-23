"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { AlertCircle, Clock, FileWarning, PackageX, Wallet, Eye } from "lucide-react";
import { OrderStatusControl } from "@/components/tenant/orders/order-status-control";
import { PaymentModal } from "@/components/tenant/orders/payment-modal";
import { formatTaka } from "@/lib/utils/calculations";
import { formatDateLocalized } from "@/lib/utils/format";
import type { Order } from "@/lib/types/order";

interface MyCollectionOrderTableProps {
  tenantId: string;
  orders: Order[];
  isLoading: boolean;
  showCostingIndicator: boolean;
}

function formatDate(order: Order, locale: string): string {
  const date = order.expectedDeliveryDate?.toDate?.();
  if (!date) return "";
  return formatDateLocalized(date, locale);
}

function isOverdue(order: Order): boolean {
  const date = order.expectedDeliveryDate?.toDate?.();
  if (!date) return false;
  if (order.status === "delivered" || order.status === "cancelled") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * blueprint T-19 (My Collection): "নিজের অর্ডার তালিকা ... ডেলিভারি চালান প্রিন্ট"।
 * T-02-এর OrderListTable-এর ভিজ্যুয়াল কনভেনশন অনুসরণ করে, কিন্তু এখানে
 * অতিরিক্ত ইনলাইন পেমেন্ট-কালেকশন অ্যাকশন যোগ করা হয়েছে (staff-এর দ্রুত
 * কাজের জন্য) — তাই ভাগাভাগি কম্পোনেন্টটি সরাসরি সম্পাদনা না করে একটি
 * পৃথক, উদ্দেশ্য-নির্দিষ্ট টেবিল তৈরি করা হয়েছে (commission মডিউলের
 * WithdrawalListTable-এর মতোই প্যাটার্ন)। কস্টিং এন্ট্রি ও চালান প্রিন্ট
 * বিদ্যমান অর্ডার ডিটেইল পেজেই থাকে (ডুপ্লিকেশন এড়াতে) — "বিস্তারিত" লিংক
 * সেখানে নিয়ে যায়।
 */
export function MyCollectionOrderTable({
  tenantId,
  orders,
  isLoading,
  showCostingIndicator,
}: MyCollectionOrderTableProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <PackageX className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("orders.noOrdersFound")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">{t("orders.orderNumber")}</th>
                <th className="px-4 py-2.5">{t("orders.customer")}</th>
                <th className="px-4 py-2.5">{t("orders.deliveryDate")}</th>
                <th className="px-4 py-2.5">{t("orders.dueAmount")}</th>
                <th className="px-4 py-2.5">{t("orders.statusColumn")}</th>
                <th className="px-4 py-2.5 text-right">{t("myCollection.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((order) => {
                const overdue = isOverdue(order);
                return (
                  <tr key={order.id} className={overdue ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-neutral-50"}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="font-mono text-xs font-medium text-brand-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      {order.orderNumber.startsWith("OFFLINE-") && (
                        <Clock className="ml-1.5 inline-block h-3 w-3 text-neutral-400" aria-hidden="true" />
                      )}
                      {showCostingIndicator && !order.hasCosting && order.status !== "cancelled" && (
                        <span className="ml-1.5 inline-block" title={t("orders.noCostingIndicator")}>
                          <FileWarning className="h-3 w-3 text-amber-500" aria-hidden="true" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {order.isUrgent && (
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
                        )}
                        <span className="font-medium text-neutral-900">{order.customerName}</span>
                      </div>
                      <p className="text-xs text-neutral-400">{order.customerPhone}</p>
                    </td>
                    <td className={`px-4 py-3 ${overdue ? "font-medium text-status-danger" : "text-neutral-600"}`}>
                      {formatDate(order, locale)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {order.dueAmount > 0 ? (
                        <span className="font-medium text-status-danger">{formatTaka(order.dueAmount)}</span>
                      ) : (
                        <span className="text-neutral-400">{formatTaka(0)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusControl tenantId={tenantId} orderId={order.id} currentStatus={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {order.dueAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => setPaymentOrder(order)}
                            title={t("orders.recordPayment")}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                          >
                            <Wallet className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          title={t("myCollection.viewOrder")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {paymentOrder && (
        <PaymentModal
          open={Boolean(paymentOrder)}
          onOpenChange={(open) => !open && setPaymentOrder(null)}
          tenantId={tenantId}
          orderId={paymentOrder.id}
          currentDue={paymentOrder.dueAmount}
          onRecorded={() => setPaymentOrder(null)}
        />
      )}
    </>
  );
}
