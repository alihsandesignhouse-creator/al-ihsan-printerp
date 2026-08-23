"use client";

import { useTranslations, useLocale } from "next-intl";
import { Check, Clock, XCircle } from "lucide-react";
import { ORDER_STATUS_FLOW } from "@/lib/types/order";
import type { OrderStatus } from "@/lib/types/order";

interface PortalStatusTimelineProps {
  status: OrderStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * blueprint T-20: "রিয়েলটাইম স্ট্যাটাস ও টাইমলাইন"। অর্ডার ডকুমেন্টে
 * প্রতিটি স্ট্যাটাস-পরিবর্তনের পৃথক টাইমস্ট্যাম্প সংরক্ষিত হয় না (শুধু
 * বর্তমান status + createdAt/updatedAt) — তাই এটি একটি ধাপ-ভিত্তিক প্রগ্রেস
 * ইন্ডিকেটর (কোন ধাপ পর্যন্ত সম্পন্ন) দেখায়, প্রতিটি পূর্ববর্তী ধাপের
 * সঠিক সময় নয় (যা এই আর্কিটেকচারে নেই) — এটি স্পষ্টভাবে "সর্বশেষ আপডেট"
 * সময় দেখিয়ে honest রাখা হয়েছে, বানানো তারিখ না দেখিয়ে।
 */
export function PortalStatusTimeline({ status, createdAt, updatedAt }: PortalStatusTimelineProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <XCircle className="h-6 w-6 shrink-0 text-status-danger" aria-hidden="true" />
        <div>
          <p className="font-medium text-status-danger">{t("orders.status.cancelled")}</p>
          <p className="text-xs text-neutral-500">{formatDate(updatedAt, locale)}</p>
        </div>
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <ol className="flex items-start justify-between">
        {ORDER_STATUS_FLOW.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li key={step} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <div
                  className={`h-0.5 flex-1 ${index === 0 ? "invisible" : isDone || isCurrent ? "bg-brand-primary" : "bg-neutral-200"}`}
                />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isDone
                      ? "bg-brand-primary text-white"
                      : isCurrent
                        ? "border-2 border-brand-primary bg-white text-brand-primary"
                        : "border-2 border-neutral-200 bg-white text-neutral-300"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clock className="h-4 w-4" aria-hidden="true" />}
                </span>
                <div
                  className={`h-0.5 flex-1 ${
                    index === ORDER_STATUS_FLOW.length - 1 ? "invisible" : isDone ? "bg-brand-primary" : "bg-neutral-200"
                  }`}
                />
              </div>
              <p className={`mt-2 text-xs font-medium ${isCurrent ? "text-brand-primary" : "text-neutral-500"}`}>
                {t(`orders.status.${step}`)}
              </p>
              {isCurrent && <p className="text-[11px] text-neutral-400">{formatDate(updatedAt, locale)}</p>}
              {index === 0 && <p className="text-[11px] text-neutral-400">{formatDate(createdAt, locale)}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
