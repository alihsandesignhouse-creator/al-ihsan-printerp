"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatTaka } from "@/lib/utils/calculations";
import { STAFF_PAYMENT_CATEGORY_ID } from "@/lib/types/expense";
import { CHART_PALETTE } from "@/lib/constants/chart-colors";
import type { ExpenseCategorySlice, ExpenseMonthlyTrendPoint } from "@/lib/types/report";

interface ExpenseAnalysisSectionProps {
  categoryBreakdown: ExpenseCategorySlice[];
  monthlyTrend: ExpenseMonthlyTrendPoint[];
  isLoading: boolean;
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
      <div className="mt-4 h-56 animate-pulse rounded bg-neutral-50" />
    </div>
  );
}

/**
 * blueprint T-18: "খরচ বিশ্লেষণ: ক্যাটাগরিওয়ারি পাই চার্ট, মাসওয়ারি ট্রেন্ড"।
 * Drilldown (সেশন ৬): ক্যাটাগরি লিস্টে ক্লিক করলে খরচ পেজে ওই ক্যাটাগরি
 * প্রি-সিলেক্ট হয়ে চলে যায় (?category=)। মাসওয়ারি ট্রেন্ড বার চার্ট
 * ক্লিকযোগ্য করা হয়নি — রিপোর্ট পেজের রেঞ্জ ও এই চার্টের মাস ভিন্ন
 * হতে পারে বলে "কোন মাস" এককভাবে নির্দিষ্ট করার সহজ কোনো টার্গেট পেজ নেই।
 */
export function ExpenseAnalysisSection({ categoryBreakdown, monthlyTrend, isLoading }: ExpenseAnalysisSectionProps) {
  const t = useTranslations();
  const router = useRouter();

  function goToExpenses(categoryId: string) {
    router.push(`/dashboard/expenses?category=${encodeURIComponent(categoryId)}`);
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  const categoryLabel = (slice: ExpenseCategorySlice) =>
    slice.categoryId === STAFF_PAYMENT_CATEGORY_ID ? t("expenses.staffPaymentCategory") : slice.categoryName;

  const pieData = categoryBreakdown.map((slice) => ({ name: categoryLabel(slice), value: slice.amount }));
  const trendData = monthlyTrend.map((point) => ({ label: t(point.monthLabelKey), amount: point.amount }));

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-neutral-900">{t("reports.expenseByCategory")}</h3>
        {pieData.length === 0 ? (
          <p className="mt-6 text-center text-sm text-neutral-400">{t("reports.noData")}</p>
        ) : (
          <>
            <div className="mt-2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                    formatter={(value: number) => [formatTaka(value), ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1.5">
              {categoryBreakdown.map((slice, i) => (
                <li key={slice.categoryId}>
                  <button
                    type="button"
                    onClick={() => goToExpenses(slice.categoryId)}
                    className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-neutral-50"
                  >
                    <span className="flex items-center gap-1.5 truncate text-neutral-600">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                      />
                      {categoryLabel(slice)}
                    </span>
                    <span className="shrink-0 font-mono text-neutral-500">
                      {formatTaka(slice.amount)} ({slice.percentage}%)
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-neutral-900">{t("reports.expenseMonthlyTrend")}</h3>
        {trendData.length === 0 ? (
          <p className="mt-6 text-center text-sm text-neutral-400">{t("reports.noData")}</p>
        ) : (
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                  formatter={(value: number) => [formatTaka(value), ""]}
                />
                <Bar dataKey="amount" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
