"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PackageSearch, RefreshCw, ArrowLeft } from "lucide-react";
import { PortalLookupForm } from "@/components/portal/portal-lookup-form";
import { PortalStatusTimeline } from "@/components/portal/portal-status-timeline";
import { PortalInvoiceView } from "@/components/portal/portal-invoice-view";
import type { PortalTrackingResult } from "@/lib/types/portal";

const POLL_INTERVAL_MS = 25_000;

/**
 * Module T-20 (গ্রাহক পোর্টাল, প্রিমিয়াম) — blueprint অংশ ২.২ অনুযায়ী
 * `/portal/*` একটি সম্পূর্ণ পাবলিক রুট (middleware.ts-এর PUBLIC_PATHS-এ
 * যোগ করা হয়েছে), লগইন ছাড়াই।
 *
 * ব্লুপ্রিন্টে বর্ণিত `{press-name}.printsaas.com.bd` কাস্টম সাবডোমেইন
 * এই সিঙ্গেল Next.js অ্যাপ-এ বাস্তবায়িত নেই (ভবিষ্যৎ ইনফ্রার বিষয়, ব্লুপ্রিন্ট
 * নিজেই ৬.২-এ একে "ভবিষ্যতে" হিসেবে চিহ্নিত করে) — তাই tenantId সরাসরি পথে
 * ব্যবহৃত হয় (`/portal/{tenantId}`), যা `slug`-এর চেয়ে নিরাপদ কারণ `slug`
 * (`lib/firebase/tenants.ts`-এ `generateSlug`) কোনো uniqueness এনফোর্স করে
 * না — দুটি ভিন্ন প্রেসের নাম থেকে একই slug তৈরি হতে পারে, যা পোর্টাল
 * লিংকে ব্যবহার করলে ভুল প্রতিষ্ঠানে নিয়ে যেতে পারত।
 *
 * "রিয়েলটাইম" আপডেট Firestore onSnapshot দিয়ে নয় — কারণ তার জন্য
 * অ্যানোনিমাস ব্যবহারকারীদের orders কালেকশনে rules খুলে দিতে হতো (নিরাপত্তা
 * ঝুঁকি)। এর বদলে পিরিয়ডিক পোলিং (~২৫ সেকেন্ড) একই সুরক্ষিত Cloud Function
 * এন্ডপয়েন্টে — blueprint-এর ৫.৪ conflict-resolution নীতির মতোই, নিরাপত্তা ও
 * সরলতাকে UX-এর চেয়ে অগ্রাধিকার দেওয়া একটি সচেতন সিদ্ধান্ত।
 */
export default function CustomerPortalPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const t = useTranslations();

  const [result, setResult] = useState<PortalTrackingResult | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lookupParamsRef = useRef<{ orderNumber: string; phone: string } | null>(null);

  function handleResult(data: PortalTrackingResult, lookup: { orderNumber: string; phone: string }) {
    setResult(data);
    setLastCheckedAt(new Date());
    lookupParamsRef.current = lookup;
  }

  async function refresh() {
    if (!lookupParamsRef.current) return;
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/portal/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...lookupParamsRef.current }),
      });
      if (res.ok) {
        const data = (await res.json()) as PortalTrackingResult;
        setResult(data);
        setLastCheckedAt(new Date());
      }
    } catch {
      // পোলিং ব্যর্থ হলে নীরবে পরের চেষ্টার জন্য অপেক্ষা — বিদ্যমান ফলাফল সরানো হয় না।
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!result) return;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!result]);

  function reset() {
    setResult(null);
    setLastCheckedAt(null);
    lookupParamsRef.current = null;
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-2 text-neutral-700">
          <PackageSearch className="h-6 w-6" aria-hidden="true" />
          <h1 className="text-xl font-semibold">{t("portal.pageTitle")}</h1>
        </div>

        {!result ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <p className="mb-4 text-sm text-neutral-500">{t("portal.pageSubtitle")}</p>
            <Suspense fallback={null}>
              <PortalLookupForm
                tenantId={tenantId}
                onResult={(data) => {
                  // orderNumber/phone were validated by the form itself before
                  // the request; re-read from the just-submitted values via a
                  // small trick: the form already sent them, so store them by
                  // reading back off the response's own order/customerPhone —
                  // safe because the lookup only ever succeeds for the phone
                  // that was actually submitted.
                  handleResult(data, { orderNumber: data.order.orderNumber, phone: data.order.customerPhone });
                }}
              />
            </Suspense>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("portal.newSearch")}
              </button>
              <button
                type="button"
                onClick={refresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                {t("portal.refresh")}
              </button>
            </div>

            <PortalStatusTimeline
              status={result.order.status}
              createdAt={result.order.createdAt}
              updatedAt={result.order.updatedAt}
            />

            <PortalInvoiceView result={result} />

            {lastCheckedAt && (
              <p className="text-center text-xs text-neutral-400" data-print-hide>
                {t("portal.lastChecked", { time: lastCheckedAt.toLocaleTimeString("bn-BD") })}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
