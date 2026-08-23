"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { TrendingUp, Users2, PieChart, AlertTriangle, Wallet, History } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/kpi-card";
import { PlanBadge } from "@/components/super-admin/TenantStatusBadge";
import { formatTaka } from "@/lib/utils/calculations";
import {
  fetchSuperAdminReportsData,
  type SuperAdminReportsData,
  type TenantRevenueBreakdown,
} from "@/lib/firebase/super-admin-reports";

export default function SuperAdminReportsPage() {
  const t = useTranslations("sa");
  // মাসের নাম (months.jan ইত্যাদি) top-level namespace-এ আছে, "sa"-এর
  // ভেতরে নয় — তাই আলাদা root-scope translator লাগবে, নাহলে next-intl
  // মিসিং-কী পড়ে raw key ("months.jan") দেখিয়ে দেয়। এটাই সেই
  // "গ্রাফে কোডিং এর লেখা দেখা যাচ্ছে" বাগের কারণ ছিল।
  const tRoot = useTranslations();
  const router = useRouter();

  const [data, setData] = useState<SuperAdminReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantRevenueBreakdown | null>(null);

  useEffect(() => {
    fetchSuperAdminReportsData()
      .then(setData)
      .catch(() => setError(t("errors.fetchFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const formatDate = (ts: { toDate: () => Date } | null) =>
    ts ? ts.toDate().toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" }) : t("common.notSet");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{t("nav.reports")}</h1>
        <p className="text-sm text-neutral-500 mt-0.5">{t("reportsPage.subtitle")}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : data ? (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={t("reportsPage.thisMonthRevenue")}
              value={`৳${(data.revenueByMonth.at(-1)?.revenue ?? 0).toLocaleString("en-US")}`}
              icon={TrendingUp}
              iconColor="text-emerald-600"
              bgColor="bg-emerald-50"
            />
            <KpiCard
              label={t("reportsPage.conversionRate")}
              value={`${data.conversion.conversionRate}%`}
              icon={PieChart}
              iconColor="text-brand-primary"
              bgColor="bg-blue-50"
            />
            <KpiCard
              label={t("reportsPage.newSignupsThisMonth")}
              value={data.signupsByMonth.at(-1)?.count ?? 0}
              icon={Users2}
              iconColor="text-amber-600"
              bgColor="bg-amber-50"
            />
            <KpiCard
              label={t("reportsPage.churnRate")}
              value={`${data.churnRatePercent}%`}
              icon={AlertTriangle}
              iconColor="text-red-600"
              bgColor="bg-red-50"
            />
          </div>

          <p className="text-xs text-neutral-400">{t("reportsPage.estimateNote")}</p>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-neutral-900">{t("reportsPage.revenueChartTitle")}</h3>
              <div className="mt-2 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.revenueByMonth.map((p) => ({ label: tRoot(p.monthLabelKey), revenue: p.revenue }))}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                      formatter={(value: number) => [`৳${value.toLocaleString("en-US")}`, ""]}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#0EA5E9" strokeWidth={2} dot={{ r: 3, fill: "#0EA5E9" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-neutral-900">{t("reportsPage.growthChartTitle")}</h3>
              <div className="mt-2 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.signupsByMonth.map((p) => ({ label: tRoot(p.monthLabelKey), count: p.count }))}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                      formatter={(value: number) => [`${value} ${t("reportsPage.tenantsUnit")}`, ""]}
                    />
                    <Bar dataKey="count" fill="#1E40AF" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Conversion detail */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-neutral-900">{t("reportsPage.conversionDetailTitle")}</h3>
            <div className="mt-3 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-semibold text-neutral-900">{data.conversion.totalTrialSignups}</p>
                <p className="text-xs text-neutral-500">{t("reportsPage.totalTrialSignups")}</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-emerald-600">{data.conversion.converted}</p>
                <p className="text-xs text-neutral-500">{t("reportsPage.convertedCount")}</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-brand-primary">{data.conversion.conversionRate}%</p>
                <p className="text-xs text-neutral-500">{t("reportsPage.conversionRate")}</p>
              </div>
            </div>
          </div>

          {/* Expired subscriptions list */}
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <div className="p-4 pb-0">
              <h3 className="text-sm font-semibold text-neutral-900">{t("reportsPage.expiredListTitle")}</h3>
            </div>
            {data.expiredTenants.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">{t("reportsPage.noExpired")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("createTenant.fields.name")}</TableHead>
                    <TableHead>{t("createTenant.fields.ownerName")}</TableHead>
                    <TableHead>{t("createTenant.fields.phone")}</TableHead>
                    <TableHead>{t("createTenant.fields.planId")}</TableHead>
                    <TableHead>{t("reportsPage.expiredOn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expiredTenants.map((tenant) => (
                    <TableRow
                      key={tenant.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                    >
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell className="text-neutral-500">{tenant.ownerName}</TableCell>
                      <TableCell className="text-neutral-500">{tenant.phone}</TableCell>
                      <TableCell>
                        <PlanBadge planId={tenant.planId} />
                      </TableCell>
                      <TableCell className="text-neutral-500">{formatDate(tenant.subscriptionEndsAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Tenant-wise revenue breakdown (session 7 drilldown) */}
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <div className="p-4 pb-0 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-brand-primary" />
              <h3 className="text-sm font-semibold text-neutral-900">{t("reportsPage.tenantRevenueTitle")}</h3>
            </div>
            <p className="px-4 pt-1 pb-0 text-xs text-neutral-400">{t("reportsPage.tenantRevenueSubtitle")}</p>
            {data.tenantRevenueBreakdown.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">{t("reportsPage.noTenantRevenue")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("createTenant.fields.name")}</TableHead>
                    <TableHead>{t("createTenant.fields.ownerName")}</TableHead>
                    <TableHead>{t("createTenant.fields.planId")}</TableHead>
                    <TableHead>{t("reportsPage.activationCount")}</TableHead>
                    <TableHead>{t("reportsPage.totalRevenueColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tenantRevenueBreakdown.map((row) => (
                    <TableRow
                      key={row.tenantId}
                      className="cursor-pointer"
                      onClick={() => setSelectedTenant(row)}
                    >
                      <TableCell className="font-medium">{row.tenantName}</TableCell>
                      <TableCell className="text-neutral-500">{row.ownerName}</TableCell>
                      <TableCell>
                        <PlanBadge planId={row.currentPlanId} />
                      </TableCell>
                      <TableCell className="text-neutral-500">{row.activationCount}</TableCell>
                      <TableCell className="font-medium text-emerald-700">
                        {formatTaka(row.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      ) : null}

      {/* Per-tenant monthly payment history modal */}
      <Dialog open={selectedTenant !== null} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="max-w-md">
          {selectedTenant && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-primary" />
                  {selectedTenant.tenantName}
                </DialogTitle>
                <DialogDescription>{t("reportsPage.historyModalSubtitle")}</DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-3">
                <div>
                  <p className="text-xs text-neutral-500">{t("reportsPage.totalRevenueColumn")}</p>
                  <p className="text-lg font-semibold text-emerald-700">
                    {formatTaka(selectedTenant.totalRevenue)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">{t("reportsPage.activationCount")}</p>
                  <p className="text-lg font-semibold text-neutral-900">{selectedTenant.activationCount}</p>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50 -mx-4 px-4 sm:-mx-6 sm:px-6">
                {selectedTenant.records.map((h) => (
                  <div key={h.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <PlanBadge planId={h.planId} />
                      <span className="text-xs text-neutral-500">
                        {h.startedAt.toDate().toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" })}
                        {" → "}
                        {h.endsAt.toDate().toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {typeof h.amountReceived === "number" ? (
                      <p className="text-xs text-green-700 font-medium mt-1">
                        {t("activateTenant.fields.amountReceived")}: {formatTaka(h.amountReceived)}
                        {h.discountValue ? (
                          <span className="text-neutral-400 font-normal">
                            {" "}
                            ({t("activateTenant.fields.discountValue")}:{" "}
                            {h.discountType === "percent" ? `${h.discountValue}%` : formatTaka(h.discountValue)})
                          </span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400 mt-1">{t("reportsPage.estimatedAmountNote")}</p>
                    )}
                    {h.paymentNotes && <p className="text-xs text-neutral-500 mt-1">{h.paymentNotes}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
