"use client";

import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { MonthlyChartPoint } from "@/lib/types/dashboard";

interface ChartCardProps {
  title: string;
  data: MonthlyChartPoint[];
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

export function MonthlyOrdersBarChart({ title, data, isLoading = false }: ChartCardProps) {
  const t = useTranslations();

  if (isLoading) return <ChartSkeleton />;

  const chartData = data.map((point) => ({
    label: t(point.monthLabelKey),
    orderCount: point.orderCount,
  }));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      <div className="mt-2 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
              formatter={(value: number) => [`${value} ${t("dashboard.ordersUnit")}`, ""]}
            />
            <Bar dataKey="orderCount" fill="#1E40AF" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MonthlyRevenueLineChart({ title, data, isLoading = false }: ChartCardProps) {
  const t = useTranslations();

  if (isLoading) return <ChartSkeleton />;

  const chartData = data.map((point) => ({
    label: t(point.monthLabelKey),
    revenue: point.revenue,
  }));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      <div className="mt-2 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
              formatter={(value: number) => [`৳${value.toLocaleString("en-US")}`, ""]}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#0EA5E9"
              strokeWidth={2}
              dot={{ r: 3, fill: "#0EA5E9" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
