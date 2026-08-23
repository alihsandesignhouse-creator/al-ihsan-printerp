"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, Plus, Ticket, Check, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditPlanModal } from "@/components/super-admin/EditPlanModal";
import { CouponFormModal } from "@/components/super-admin/CouponFormModal";
import { ConfirmDialog } from "@/components/super-admin/ConfirmDialog";
import {
  subscribeSubscriptionPlans,
  subscribeCoupons,
  setCouponActive,
} from "@/lib/firebase/subscription-plans";
import type { SubscriptionPlanCatalogEntry, CouponCode } from "@/lib/types/subscription-plan";
import { ACTIVE_BADGE_CLASS, INACTIVE_BADGE_CLASS } from "@/lib/constants/status-colors";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

const PLAN_ACCENT: Record<string, string> = {
  basic: "border-blue-200",
  standard: "border-brand-primary",
  premium: "border-amber-300",
};

export default function SubscriptionPackagesPage() {
  const t = useTranslations("sa");
  const locale = useLocale();
  const { user } = useAuthStore();

  const [section, setSection] = useState<"plans" | "coupons">("plans");

  const [plans, setPlans] = useState<SubscriptionPlanCatalogEntry[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanCatalogEntry | null>(null);

  const [coupons, setCoupons] = useState<CouponCode[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(true);
  const [couponFormOpen, setCouponFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponCode | null>(null);
  const [toggleTarget, setToggleTarget] = useState<CouponCode | null>(null);

  useEffect(() => {
    const unsub = subscribeSubscriptionPlans(
      (data) => {
        setPlans(data);
        setPlansLoading(false);
      },
      () => setPlansLoading(false)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeCoupons(
      (data) => {
        setCoupons(data);
        setCouponsLoading(false);
      },
      () => setCouponsLoading(false)
    );
    return () => unsub();
  }, []);

  async function handleToggleCoupon() {
    if (!toggleTarget) return;
    try {
      await setCouponActive(toggleTarget.id, !toggleTarget.isActive);
      toast.success(t("subscriptionPlans.saveSuccess"));
    } catch {
      toast.error(t("subscriptionPlans.saveError"));
    } finally {
      setToggleTarget(null);
    }
  }

  function formatDate(ts: CouponCode["validFrom"]): string {
    return ts.toDate().toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const formatMoney = (n: number) => `৳${n.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{t("nav.packages")}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{t("subscriptionPlans.pageSubtitle")}</p>
        </div>
      </div>

      <Tabs value={section} onValueChange={(v) => setSection(v as "plans" | "coupons")}>
        <TabsList>
          <TabsTrigger value="plans">{t("subscriptionPlans.tabPlans")}</TabsTrigger>
          <TabsTrigger value="coupons">{t("subscriptionPlans.tabCoupons")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "plans" && (
        <>
          {plansLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const features = locale === "bn" ? plan.featuresBn : plan.featuresEn;
                return (
                  <div
                    key={plan.id}
                    className={`flex flex-col rounded-xl border-2 bg-white p-5 ${PLAN_ACCENT[plan.id] ?? "border-neutral-200"}`}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        {t(`subscriptionPlans.planName.${plan.id}`)}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingPlan(plan)}
                        title={t("common.edit")}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-2">
                      <span className="text-2xl font-semibold text-neutral-900">{formatMoney(plan.monthlyPrice)}</span>
                      <span className="text-sm text-neutral-400">{t("subscriptionPlans.perMonth")}</span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      {formatMoney(plan.yearlyPrice)} {t("subscriptionPlans.perYear")}
                    </p>

                    <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                      <p>
                        {t("subscriptionPlans.maxStaff")}:{" "}
                        <span className="font-medium text-neutral-700">
                          {plan.maxStaff === null ? t("subscriptionPlans.unlimitedLabel") : plan.maxStaff}
                        </span>
                      </p>
                      <p>
                        {t("subscriptionPlans.maxBranches")}:{" "}
                        <span className="font-medium text-neutral-700">
                          {plan.maxBranches === null ? t("subscriptionPlans.unlimitedLabel") : plan.maxBranches}
                        </span>
                      </p>
                    </div>

                    <ul className="mt-3 flex-1 space-y-1.5 text-xs text-neutral-600">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {section === "coupons" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingCoupon(null);
                setCouponFormOpen(true);
              }}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t("subscriptionPlans.newCoupon")}
            </Button>
          </div>

          {couponsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
              <Ticket className="h-8 w-8 text-neutral-300" />
              <p className="text-sm text-neutral-400">{t("subscriptionPlans.noCoupons")}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("subscriptionPlans.couponCode")}</TableHead>
                    <TableHead>{t("subscriptionPlans.discountValue")}</TableHead>
                    <TableHead>{t("subscriptionPlans.validFrom")}</TableHead>
                    <TableHead>{t("subscriptionPlans.validUntil")}</TableHead>
                    <TableHead>{t("subscriptionPlans.usage")}</TableHead>
                    <TableHead>{t("subscriptionPlans.isActive")}</TableHead>
                    <TableHead className="text-right">{t("subscriptionPlans.actionsHeader")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{c.code}</TableCell>
                      <TableCell>
                        {c.discountType === "percent" ? `${c.discountValue}%` : formatMoney(c.discountValue)}
                      </TableCell>
                      <TableCell className="text-neutral-500">{formatDate(c.validFrom)}</TableCell>
                      <TableCell className="text-neutral-500">{formatDate(c.validUntil)}</TableCell>
                      <TableCell className="text-neutral-500">
                        {c.usedCount}
                        {c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.isActive ? ACTIVE_BADGE_CLASS : INACTIVE_BADGE_CLASS
                          }`}
                        >
                          {c.isActive ? t("subscriptionPlans.active") : t("subscriptionPlans.inactive")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title={t("common.edit")}
                            onClick={() => {
                              setEditingCoupon(c);
                              setCouponFormOpen(true);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title={c.isActive ? t("subscriptionPlans.deactivate") : t("subscriptionPlans.activate")}
                            onClick={() => setToggleTarget(c)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 ${
                              c.isActive ? "text-red-500" : "text-emerald-600"
                            }`}
                          >
                            {c.isActive ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <EditPlanModal
        open={editingPlan !== null}
        onOpenChange={(open) => !open && setEditingPlan(null)}
        plan={editingPlan}
        adminId={user?.uid ?? ""}
      />

      <CouponFormModal
        open={couponFormOpen}
        onOpenChange={setCouponFormOpen}
        editingCoupon={editingCoupon}
        adminId={user?.uid ?? ""}
      />

      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={
          toggleTarget?.isActive ? t("subscriptionPlans.deactivateTitle") : t("subscriptionPlans.activateTitle")
        }
        description={t("subscriptionPlans.toggleDescription", { code: toggleTarget?.code ?? "" })}
        confirmLabel={toggleTarget?.isActive ? t("subscriptionPlans.deactivate") : t("subscriptionPlans.activate")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleToggleCoupon}
        destructive={toggleTarget?.isActive}
      />
    </div>
  );
}
