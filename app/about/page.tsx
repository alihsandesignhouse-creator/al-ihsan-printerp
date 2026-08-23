"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandLogoLockup } from "@/components/shared/brand-logo";
import { AboutContent } from "@/components/shared/about-content";

/**
 * app/about/page.tsx — "নির্মাতার পরিচিতি" (১৩ আগস্ট ২০২৬, dashboard-shell
 * ফিক্স সেশনে ১৪ আগস্ট ২০২৬-এ আপডেট)
 *
 * publicly reachable — middleware.ts-এর PUBLIC_PATHS-এ "/about" যোগ করা
 * হয়েছে, লগইন ছাড়াই খোলা যাবে (login/signup/trial-expired পেজের ফুটার
 * থেকে লিংক করা)। এটা ইচ্ছাকৃতভাবে এই standalone/full-page শেল-এই থাকছে
 * (own header + back link) — লগইন-করা ব্যবহারকারীদের জন্য আলাদা একটা রুট
 * (app/(tenant)/dashboard/about/page.tsx) যোগ করা হয়েছে যা TenantShell-এর
 * ভেতরে (সাইডবার স্থির) রেন্ডার হয়, সাইডবারের "nav.about" লিংক এখন সেই
 * রুটে যায় — আগে সরাসরি এখানে (/about) আসায় পুরো ড্যাশবোর্ড-শেল থেকে
 * বেরিয়ে যেত।
 *
 * বডি-টেক্সট, quote, ও কন্টাক্ট ব্লক এখন components/shared/about-content.tsx
 * থেকে আসে (দুই রুটে ডুপ্লিকেট JSX এড়াতে) — সেই ফাইলের কমেন্টে
 * hardcoded-বাংলা ব্যতিক্রমের পূর্ণ ব্যাখ্যা আছে। এই পেজে শুধু নেভিগেশন/
 * লিংক টেক্সট (ArrowLeft ব্যাক-লিংক) থাকে, যা প্রকৃত UI লেবেল।
 */
export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-100 px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <BrandLogoLockup size={28} tone="dark" />
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            ফিরে যান
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">নির্মাতার পরিচিতি</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          মাওলানা মুফতি মুহাম্মাদ ওমর ফারুক
        </h1>
        <p className="mt-1 text-sm text-neutral-500">প্রতিষ্ঠাতা, AL-IHSAN PrintERP</p>

        <div className="prose-content mt-8">
          <AboutContent />
        </div>
      </main>
    </div>
  );
}
