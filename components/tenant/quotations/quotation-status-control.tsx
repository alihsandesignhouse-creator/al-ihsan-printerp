"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateQuotationStatus } from "@/lib/firebase/quotations";
import type { QuotationStatus } from "@/lib/types/quotation";

// 'expired' বাদ দেওয়া হয়েছে — এটা শুধু checkQuotationExpiry Cloud Function
// স্বয়ংক্রিয়ভাবে সেট করে (blueprint T-14), ম্যানুয়ালি বেছে নেওয়ার অপশন নয়।
const MANUAL_STATUS_OPTIONS: QuotationStatus[] = ["draft", "sent", "accepted", "rejected"];

const SELECT_CLASSES: Record<QuotationStatus, string> = {
  draft: "border-neutral-200 bg-neutral-50 text-neutral-600",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  expired: "border-amber-200 bg-amber-50 text-amber-700",
};

interface QuotationStatusControlProps {
  tenantId: string;
  quotationId: string;
  currentStatus: QuotationStatus;
  onChanged?: (status: QuotationStatus) => void;
}

export function QuotationStatusControl({
  tenantId,
  quotationId,
  currentStatus,
  onChanged,
}: QuotationStatusControlProps) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [pendingReject, setPendingReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyStatus(status: QuotationStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateQuotationStatus(tenantId, quotationId, status);
        onChanged?.(status);
      } catch {
        setError(t("quotations.statusUpdateFailed"));
      }
    });
  }

  function handleChange(value: string) {
    const status = value as QuotationStatus;
    if (status === currentStatus) return;
    if (status === "rejected") {
      setPendingReject(true);
      return;
    }
    applyStatus(status);
  }

  // 'expired' অবস্থায় থাকা কোটেশন ম্যানুয়ালি dropdown-এ দেখানো হয় (যাতে
  // ব্যবহারকারী বুঝতে পারেন এটা কেন এই অবস্থায়), কিন্তু বেছে নেওয়া যায় না।
  const options = MANUAL_STATUS_OPTIONS.includes(currentStatus)
    ? MANUAL_STATUS_OPTIONS
    : [currentStatus, ...MANUAL_STATUS_OPTIONS];

  return (
    <>
      <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
        <select
          value={currentStatus}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.value)}
          aria-label={t("quotations.changeStatus")}
          className={`h-8 appearance-none rounded-md border pl-2 pr-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-60 ${SELECT_CLASSES[currentStatus]}`}
        >
          {options.map((status) => (
            <option key={status} value={status} disabled={status === "expired"}>
              {t(`quotations.status.${status}`)}
            </option>
          ))}
        </select>
        {isPending ? (
          <Loader2 className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5" aria-hidden="true" />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}

      <AlertDialog open={pendingReject} onOpenChange={setPendingReject}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("quotations.confirmRejectTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("quotations.confirmRejectDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-status-danger text-white hover:bg-status-danger/90"
              onClick={() => {
                setPendingReject(false);
                applyStatus("rejected");
              }}
            >
              {t("quotations.confirmRejectAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
