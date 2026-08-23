"use client";

import { useTranslations } from "next-intl";
import { Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/utils/csv-export";

interface CsvExportButtonProps {
  /** computeEffectiveFeatures(...).dataExport — ব্লুপ্রিন্ট: "ডেটা এক্সপোর্ট (CSV/Excel) — প্রিমিয়াম"। */
  hasDataExportFeature: boolean;
  /** ".csv" ছাড়া ফাইলনাম-প্রিফিক্স — একটি টাইমস্ট্যাম্প স্বয়ংক্রিয়ভাবে যোগ হয়। */
  filenamePrefix: string;
  headers: string[];
  rows: (string | number)[][];
  /** ছোট তালিকায় বাটনের আকার — পেজ হেডারে "নতুন..." প্রাইমারি বাটনের পাশে সেকেন্ডারি হিসেবে বসে (blueprint ১৪.১: প্রতি পেজে সর্বোচ্চ একটি Primary)। */
  size?: "sm" | "default";
}

/**
 * blueprint Phase 3 #৩০: "ডেটা এক্সপোর্ট (CSV/Excel)"। T-18 রিপোর্ট পেজের
 * `ExportCsvButton`-এর মতোই আচরণ (লক আইকন যখন প্ল্যানে ফিচার নেই, নাহলে
 * সরাসরি ব্রাউজার ডাউনলোড) — কিন্তু এখানে যেকোনো তালিকা পেজে পুনঃব্যবহারযোগ্য
 * জেনেরিক সংস্করণ হিসেবে (অর্ডার/কাস্টমার/পেমেন্ট লেজার/খরচ/স্টক/সাপ্লায়ার)।
 * পেজ যা ফিল্টার করে দেখাচ্ছে ঠিক সেটাই এক্সপোর্ট হয় — আলাদা কোনো এক্সপোর্ট-
 * নির্দিষ্ট কোয়েরি নেই।
 */
export function CsvExportButton({
  hasDataExportFeature,
  filenamePrefix,
  headers,
  rows,
  size = "sm",
}: CsvExportButtonProps) {
  const t = useTranslations();

  if (!hasDataExportFeature) {
    return (
      <button
        type="button"
        disabled
        title={t("settings.locked.contact")}
        className="flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-400"
      >
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        {t("common.exportCsv")}
      </button>
    );
  }

  function handleExport() {
    downloadCsv(`${filenamePrefix}-${Date.now()}.csv`, headers, rows);
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={handleExport} disabled={rows.length === 0}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {t("common.exportCsv")}
    </Button>
  );
}
