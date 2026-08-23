"use client";

import { useTranslations } from "next-intl";
import { Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/utils/csv-export";
import { STAFF_PAYMENT_CATEGORY_ID } from "@/lib/types/expense";
import type {
  FinancialReportKpis,
  BranchComparisonRow,
  ItemAnalysisResult,
  StaffPerformanceRow,
  ExpenseCategorySlice,
} from "@/lib/types/report";

interface ExportCsvButtonProps {
  hasDataExportFeature: boolean;
  rangeLabel: string;
  kpis: FinancialReportKpis;
  branchComparison: BranchComparisonRow[];
  itemAnalysis: ItemAnalysisResult;
  staffPerformance: StaffPerformanceRow[];
  expenseCategoryBreakdown: ExpenseCategorySlice[];
}

/**
 * blueprint T-18: "এক্সপোর্ট: Excel / PDF / CSV (প্রিমিয়াম)"। এই সেশনের
 * সিদ্ধান্ত: একটি একক CSV ফাইলে বিভাগ-অনুযায়ী সেকশন (blank-line দিয়ে আলাদা) —
 * একাধিক ফাইল ডাউনলোড করানোর চেয়ে সহজ, এবং Excel-এ সরাসরি খোলে। সংখ্যাগুলো
 * অ-ফরম্যাটেড (raw) রাখা হয়েছে যাতে Excel/Sheets সরাসরি যোগফল/সূত্র করতে পারে।
 */
export function ExportCsvButton({
  hasDataExportFeature,
  rangeLabel,
  kpis,
  branchComparison,
  itemAnalysis,
  staffPerformance,
  expenseCategoryBreakdown,
}: ExportCsvButtonProps) {
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
        {t("reports.exportCsv")}
      </button>
    );
  }

  function handleExport() {
    const rows: (string | number)[][] = [];

    rows.push([t("reports.exportTitle")]);
    rows.push([rangeLabel]);
    rows.push([]);

    rows.push([t("reports.financialSummary")]);
    rows.push([t("reports.orderCount"), kpis.orderCount]);
    rows.push([t("reports.totalRevenue"), kpis.totalRevenue]);
    rows.push([t("reports.totalCollection"), kpis.totalCollection]);
    rows.push([t("reports.totalCosting"), kpis.totalCosting]);
    rows.push([t("reports.grossProfit"), kpis.grossProfit]);
    rows.push([t("reports.totalExpense"), kpis.totalExpense]);
    rows.push([t("reports.netProfit"), kpis.netProfit]);
    rows.push([t("reports.totalDue"), kpis.totalDue]);
    rows.push([]);

    if (branchComparison.length > 0) {
      rows.push([t("reports.branchComparison")]);
      rows.push([
        t("reports.branch"),
        t("reports.orderCount"),
        t("reports.totalRevenue"),
        t("reports.grossProfit"),
        t("reports.netProfit"),
        t("reports.totalDue"),
      ]);
      branchComparison.forEach((b) =>
        rows.push([b.branchName, b.orderCount, b.totalRevenue, b.grossProfit, b.netProfit, b.totalDue])
      );
      rows.push([]);
    }

    if (itemAnalysis.rows.length > 0) {
      rows.push([t("reports.itemAnalysis")]);
      rows.push([t("reports.itemName"), t("reports.itemOrderCount"), t("reports.itemQuantity"), t("reports.totalRevenue")]);
      itemAnalysis.rows.forEach((row) => rows.push([row.itemName, row.orderCount, row.totalQuantity, row.totalRevenue]));
      rows.push([]);
    }

    if (staffPerformance.length > 0) {
      rows.push([t("reports.staffPerformance")]);
      rows.push([
        t("reports.staffName"),
        t("reports.orderCount"),
        t("reports.totalRevenue"),
        t("reports.totalCollection"),
        t("reports.commissionAmount"),
      ]);
      staffPerformance.forEach((s) =>
        rows.push([s.staffName, s.orderCount, s.totalRevenue, s.totalCollection, s.commissionAmount ?? ""])
      );
      rows.push([]);
    }

    if (expenseCategoryBreakdown.length > 0) {
      rows.push([t("reports.expenseByCategory")]);
      rows.push([t("expenses.category"), t("expenses.amount"), "%"]);
      expenseCategoryBreakdown.forEach((c) =>
        rows.push([
          c.categoryId === STAFF_PAYMENT_CATEGORY_ID ? t("expenses.staffPaymentCategory") : c.categoryName,
          c.amount,
          c.percentage,
        ])
      );
    }

    const headerRow = rows[0]?.map(String) ?? [];
    downloadCsv(`al-ihsan-printerp-report-${Date.now()}.csv`, headerRow, rows.slice(1));
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {t("reports.exportCsv")}
    </Button>
  );
}
