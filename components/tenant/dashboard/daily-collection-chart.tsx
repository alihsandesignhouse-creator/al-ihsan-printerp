"use client";

import { useTranslations } from "next-intl";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { DailyCollectionPoint } from "@/lib/types/dashboard";

interface DailyCollectionChartProps {
  title: string;
  data: DailyCollectionPoint[];
  isLoading?: boolean;
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
      <div className="mt-4 h-48 animate-pulse rounded bg-neutral-50" />
    </div>
  );
}

export function DailyCollectionChart({ title, data, isLoading = false }: DailyCollectionChartProps) {
  const t = useTranslations();

  if (isLoading) return <ChartSkeleton />;

  const chartData = data.map((point) => ({
    label: String(point.day),
    amount: point.amount,
  }));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      <div className="mt-2 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
              formatter={(value: number) => [`৳${value.toLocaleString("en-US")}`, ""]}
            />
            <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-neutral-400">{t("dashboard.currentMonth")}</p>
    </div>
  );
}
