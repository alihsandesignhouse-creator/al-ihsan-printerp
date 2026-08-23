"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { AboutContent } from "@/components/shared/about-content";

/**
 * app/(tenant)/dashboard/about/page.tsx — "নির্মাতার পরিচিতি" (১৪ আগস্ট ২০২৬,
 * dashboard-shell ফিক্স সেশন)
 *
 * আগে সাইডবারের "nav.about" আইটেম সরাসরি পাবলিক /about রুটে (আলাদা
 * স্ট্যান্ডঅ্যালোন পেজ, নিজস্ব header/back-button সহ) নিয়ে যেত — লগইন-করা
 * অবস্থায় ক্লিক করলে পুরো TenantShell (সাইডবার + top navbar + trial
 * banner) থেকে বেরিয়ে যেত। এই নতুন রুটটা অন্য সব ড্যাশবোর্ড মডিউলের মতোই
 * app/(tenant)/dashboard/ layout-এর ভেতরে বসে, তাই TenantShell স্থির থাকে
 * (সাইডবার/টপ-নেভবার অপরিবর্তিত), শুধু ডান পাশের কন্টেন্ট এরিয়া বদলায়।
 * components/tenant/layout/sidebar.tsx-এর href এখন "/dashboard/about"-এ
 * বদলানো হয়েছে (আগে "/about" ছিল)।
 *
 * পাবলিক app/about/page.tsx রুটটা অপরিবর্তিত ও পৃথকভাবে বেঁচে থাকে —
 * middleware.ts PUBLIC_PATHS-এ থাকায় লগইন ছাড়াও দেখা যায়, login/signup/
 * trial-expired ফুটার-লিংকের জন্য দরকার। দুটো রুটই এখন একই
 * components/shared/about-content.tsx ভাগ করে নেয় যাতে বায়ো/quote/contact
 * JSX ডুপ্লিকেট না হয়। সব রোল (tenant_admin, branch_manager,
 * commission_staff, regular_staff) সাইডবারে এই লিংক দেখেন (নিরাপত্তা-
 * সংবেদনশীল কিছু না, প্যাকেজ/ফিচার-গেট নেই) — তাই এই পেজেও কোনো role
 * guard নেই, dashboard layout-এর সাধারণ auth guard-ই যথেষ্ট।
 */
export default function TenantAboutPage() {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5 text-neutral-700" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-neutral-900">{t("nav.about")}</h1>
      </div>
      <p className="text-sm text-neutral-500">{t("about.pageSubtitle")}</p>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold tracking-tight text-neutral-900">মাওলানা মুফতি মুহাম্মাদ ওমর ফারুক</h2>
        <p className="mt-1 text-sm text-neutral-500">প্রতিষ্ঠাতা, AL-IHSAN PrintERP</p>

        <div className="mt-6">
          <AboutContent />
        </div>
      </div>
    </div>
  );
}
