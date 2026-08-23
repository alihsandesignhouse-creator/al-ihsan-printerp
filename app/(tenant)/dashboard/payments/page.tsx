"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Wallet, AlertTriangle } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeToTenantPayments, subscribeToOrders } from "@/lib/firebase/orders";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { PaymentFiltersBar } from "@/components/tenant/payments/payment-filters-bar";
import { PaymentListTable } from "@/components/tenant/payments/payment-list-table";
import { PaymentReceipt } from "@/components/tenant/customers/payment-receipt";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { buildPresetRange } from "@/components/tenant/reports/date-range-filter";
import { formatDateLocalized } from "@/lib/utils/format";
import { formatTaka } from "@/lib/utils/calculations";
import type { PaymentMethod, Order } from "@/lib/types/order";
import type { Branch, Payment } from "@/lib/types/dashboard";
import type { ReportDateRange } from "@/lib/types/report";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Module T-05 (blueprint অংশ ৮), AUDIT-REPORT-2.md item #3: সাইডবারে
 * "পেমেন্ট" লিংক ও ড্যাশবোর্ডের "আজকের কালেকশন" কার্ড আগে থেকেই এই
 * পেজে যেত কিন্তু পেজটাই তৈরি হয়নি ছিল — এই কম্পোনেন্ট সেই gap বন্ধ করে।
 * পেমেন্ট এখনো অর্ডার ডিটেইল মডাল থেকেই রেকর্ড হয় (recordPayment()
 * অপরিবর্তিত); এই পেজ শুধু সব পেমেন্টের একটা কেন্দ্রীয়, ফিল্টারযোগ্য
 * তালিকা + রিসিট রিপ্রিন্ট + CSV এক্সপোর্ট (প্রিমিয়াম) দেয়, এবং
 * ফ্রি-এডিশন সংযোজন হিসেবে (SMS ছাড়া) আজকের বকেয়া-তাগাদা তালিকা দেখায়।
 */
export default function PaymentsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const isTenantAdmin = role === "tenant_admin";

  const selectedBranchId = useUIStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useUIStore((s) => s.setSelectedBranchId);
  const effectiveBranchId = isTenantAdmin ? selectedBranchId : (user?.claims.branchId ?? "all");
  const handleFirestoreError = useFirestoreErrorHandler();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [dueOrders, setDueOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDataExportFeature, setHasDataExportFeature] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<{ name: string; logoUrl: string; address: string } | null>(null);

  const [search, setSearch] = useState("");
  const [methodId, setMethodId] = useState<PaymentMethod | "all">("all");
  const [range, setRange] = useState<ReportDateRange>(() => {
    // ড্যাশবোর্ডের "আজকের কালেকশন" কার্ড থেকে এলে (?range=today) সরাসরি
    // আজকের রেঞ্জ প্রি-সিলেক্টেড দেখানো হয়, নাহলে ডিফল্ট এই মাস।
    if (searchParams.get("range") === "today") {
      const now = new Date();
      return { start: startOfDay(now), end: endOfDay(now), preset: "custom" };
    }
    return buildPresetRange("thisMonth");
  });

  const [showReceiptFor, setShowReceiptFor] = useState<Payment | null>(null);
  const [receiptBranch, setReceiptBranch] = useState<Branch | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (tenant) => {
        if (!tenant) return;
        setHasDataExportFeature(
          computeEffectiveFeatures(tenant.planId, tenant.featureOverrides, tenant.planFeatures).dataExport
        );
        setTenantInfo({ name: tenant.name, logoUrl: tenant.logoUrl, address: tenant.address });
      },
      handleFirestoreError()
    );
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);
    const unsub = subscribeToTenantPayments(
      tenantId,
      { branchId: effectiveBranchId },
      (data) => {
        setPayments(data);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  // ফ্রি-এডিশন সংযোজন: বকেয়া আদায়ের রিমাইন্ডার তালিকা (SMS ছাড়া, শুধু
  // ভিউ) — আজ বা তার আগে ডেলিভারি প্রত্যাশিত এমন অর্ডার যেখানে এখনো
  // বকেয়া আছে। subscribeToOrders() আগে থেকেই expectedDeliveryDate
  // অনুযায়ী সাজানো দেয় বলে অতিরিক্ত সর্ট লাগে না।
  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeToOrders(
      tenantId,
      { branchId: effectiveBranchId, status: "all", staffId: "all" },
      (orders) => {
        const now = endOfDay(new Date());
        setDueOrders(
          orders.filter(
            (o) => o.dueAmount > 0 && o.status !== "cancelled" && o.expectedDeliveryDate.toDate() <= now
          )
        );
      },
      handleFirestoreError()
    );
    return () => unsub();
  }, [tenantId, effectiveBranchId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !showReceiptFor) {
      setReceiptBranch(null);
      return;
    }
    getDoc(doc(db, "tenants", tenantId, "branches", showReceiptFor.branchId)).then((snap) => {
      setReceiptBranch(snap.exists() ? ({ id: snap.id, ...snap.data() } as Branch) : null);
    });
  }, [tenantId, showReceiptFor]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((p) => {
      const paidAt = p.paymentDate?.toDate?.();
      if (!paidAt || paidAt < range.start || paidAt > range.end) return false;
      if (methodId !== "all" && p.paymentMethod !== methodId) return false;
      if (term) {
        const haystack = `${p.orderNumber ?? p.orderId} ${p.customerName ?? ""} ${p.customerPhone ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [payments, search, methodId, range]);

  const totalCollected = useMemo(
    () => filteredPayments.reduce((sum, p) => sum + p.amount, 0),
    [filteredPayments]
  );

  const exportRows = useMemo(
    () =>
      filteredPayments.map((p) => [
        p.paymentDate?.toDate?.() ? formatDateLocalized(p.paymentDate.toDate(), locale) : "",
        p.orderNumber ?? p.orderId,
        p.customerName ?? "",
        p.customerPhone ?? "",
        t(`orders.paymentMethod.${p.paymentMethod}`),
        p.amount,
      ]),
    [filteredPayments, t, locale]
  );

  if (!tenantId) return null;

  if (showReceiptFor && tenantInfo) {
    return (
      <div className="p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setShowReceiptFor(null)}
          data-print-hide
          className="mb-3 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </button>
        <PaymentReceipt
          payment={showReceiptFor}
          orderNumber={showReceiptFor.orderNumber ?? showReceiptFor.orderId}
          customerName={showReceiptFor.customerName ?? ""}
          customerPhone={showReceiptFor.customerPhone ?? ""}
          branch={receiptBranch}
          tenant={{ name: tenantInfo.name, logoUrl: tenantInfo.logoUrl, address: tenantInfo.address, footerMessage: "" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("payments.pageTitle")}</h1>
        <CsvExportButton
          hasDataExportFeature={hasDataExportFeature}
          filenamePrefix="al-ihsan-printerp-payments"
          headers={[
            t("customers.paymentDate"),
            t("orders.orderNumber"),
            t("orders.customer"),
            t("orders.customerPhone"),
            t("orders.paymentMethodLabel"),
            t("customers.amount"),
          ]}
          rows={exportRows}
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Wallet className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          {t("payments.totalCollected")}
        </div>
        <p className="mt-1 text-2xl font-bold text-neutral-900">{formatTaka(totalCollected)}</p>
      </div>

      {dueOrders.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {t("payments.dueReminderTitle")}
          </div>
          <div className="space-y-1.5">
            {dueOrders.slice(0, 8).map((o) => (
              <a
                key={o.id}
                href={`/dashboard/orders/${o.id}`}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm hover:bg-neutral-50"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-neutral-800">{o.customerName}</span>
                  <span className="text-xs text-neutral-400">
                    {o.customerPhone} · {o.orderNumber}
                  </span>
                </span>
                <span className="font-mono font-semibold text-amber-700">{formatTaka(o.dueAmount)}</span>
              </a>
            ))}
          </div>
          {dueOrders.length > 8 && (
            <p className="mt-2 text-xs text-amber-700">
              {t("payments.dueReminderMore", { count: dueOrders.length - 8 })}
            </p>
          )}
        </div>
      )}

      <PaymentFiltersBar
        search={search}
        onSearchChange={setSearch}
        methodId={methodId}
        onMethodChange={setMethodId}
        branches={isTenantAdmin ? branches : []}
        branchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        range={range}
        onRangeChange={setRange}
      />

      <PaymentListTable
        payments={filteredPayments}
        branches={branches}
        isLoading={isLoading}
        onPrintReceipt={setShowReceiptFor}
      />
    </div>
  );
}
