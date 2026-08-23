"use client";

import type { ReactNode } from "react";
import { WifiOff, Globe, ShieldCheck } from "lucide-react";
import { BrandLogoLockup } from "@/components/shared/brand-logo";

interface AuthSplitLayoutProps {
  logoUrl?: string;
  /** সাইনআপের মতো ফিল্ড-বেশি ফর্মের জন্য বাম প্যানেলের max-width বাড়ায় (max-w-sm → max-w-lg)। */
  wide?: boolean;
  children: ReactNode;
}

/**
 * components/shared/auth-split-layout.tsx
 *
 * প্রিমিয়াম auth-পেজ রিডিজাইন (৯ আগস্ট ২০২৬) — Login/Signup/Forgot-password
 * তিনটা পেজেই একই শেয়ার্ড split-screen শেল, যাতে পুরো auth-flow-টা
 * সামঞ্জস্যপূর্ণ লাগে (শুধু একটা পেজ বদলালে বাকিগুলোর সাথে অসামঞ্জস্য
 * হয়ে যেত)।
 *
 * ডান প্যানেল lg breakpoint-এর নিচে লুকানো — ছোট স্ক্রিনে (যেখানে এই
 * অ্যাপের বেশিরভাগ ব্যবহারকারী আসলে থাকবেন, ব্লুপ্রিন্টের mobile-first
 * নীতি অনুযায়ী) শুধু ফর্মটাই দেখাবে, কোনো জায়গা নষ্ট হবে না।
 *
 * ওয়েভি ডিভাইডার (১২ আগস্ট ২০২৬): ব্যবহারকারীর দেওয়া দুটো রেফারেন্স
 * ডিজাইনের (Blueflame/Spacer) মধ্যে Spacer-এর layered cloud-wave
 * বাউন্ডারিটা বেছে নেওয়া হলো — সোজা প্যানেল-কাটের চেয়ে বেশি প্রিমিয়াম।
 * তিনটা wave layer একই brand-primary রঙের ভিন্ন opacity-তে (হালকা →
 * গাঢ়) সাদা প্যানেল থেকে নীল প্যানেলে ধীরে মিশে যায়। প্রতিটা layer-এর
 * path প্রোগ্রাম্যাটিকভাবে (sine-wave বেজিয়ার) জেনারেট করা, হার্ডকোড
 * ম্যাজিক-নাম্বার-হীন কোনো ছবি/asset ছাড়াই — তাই কোনো নতুন ফাইল/ইমপোর্ট
 * লাগে না।
 *
 * এই কম্পোনেন্ট নিজে কোনো auth লজিক স্পর্শ করে না — শুধু লেআউট/ভিজ্যুয়াল
 * শেল, `children`-এ আসল ফর্ম বসে।
 */

/** Spacer-স্টাইল layered cloud-wave ডিভাইডার — শুধু lg+ স্ক্রিনে দৃশ্যমান।
 *  ব্র্যান্ড প্যানেল/ফর্ম-প্যানেলের সোয়াপ (১২ আগস্ট ২০২৬, "পরিচিতি বাম পাশে,
 *  লগইন অপশন ডান পাশে") পর boundary সরে গেছে ৪৬%→৫৪%-এ (ব্র্যান্ড প্যানেল
 *  lg:order-1 হয়ে এখন প্রথমে/বামে বসছে, ৫৪% প্রশস্ত)। path-এর কোঅর্ডিনেট
 *  নতুন করে জেনারেট না করে scaleX(-1) দিয়ে আয়না-প্রতিবিম্ব করা হলো — কারণ
 *  আগে solid ফিল ছিল ডান দিকে (তখনকার নীল প্যানেলের দিকে), এখন সেই একই
 *  solid দিকটা বাম দিকে (এখনকার নীল প্যানেলের দিকে) দরকার। */
function WaveDivider() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10 hidden lg:block"
      style={{ left: "45%", width: "18%", transform: "scaleX(-1)" }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 800"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <path
          d="M46.00,0.00 C46.00,16.67 50.78,16.67 50.78,33.33 C50.78,50.00 54.40,50.00 54.40,66.67 C54.40,83.33 55.97,83.33 55.97,100.00 C55.97,116.67 55.12,116.67 55.12,133.33 C55.12,150.00 52.04,150.00 52.04,166.67 C52.04,183.33 47.49,183.33 47.49,200.00 C47.49,216.67 42.58,216.67 42.58,233.33 C42.58,250.00 38.50,250.00 38.50,266.67 C38.50,283.33 36.25,283.33 36.25,300.00 C36.25,316.67 36.37,316.67 36.37,333.33 C36.37,350.00 38.84,350.00 38.84,366.67 C38.84,383.33 43.05,383.33 43.05,400.00 C43.05,416.67 47.98,416.67 47.98,433.33 C47.98,450.00 52.43,450.00 52.43,466.67 C52.43,483.33 55.31,483.33 55.31,500.00 C55.31,516.67 55.92,516.67 55.92,533.33 C55.92,550.00 54.12,550.00 54.12,566.67 C54.12,583.33 50.34,583.33 50.34,600.00 C50.34,616.67 45.50,616.67 45.50,633.33 C45.50,650.00 40.79,650.00 40.79,666.67 C40.79,683.33 37.34,683.33 37.34,700.00 C37.34,716.67 36.00,716.67 36.00,733.33 C36.00,750.00 37.10,750.00 37.10,766.67 C37.10,783.33 40.37,783.33 40.37,800.00 L100.00,800.00 L100.00,0 Z"
          className="fill-brand-primary"
          fillOpacity={0.16}
        />
        <path
          d="M55.73,0.00 C55.73,16.67 56.96,16.67 56.96,33.33 C56.96,50.00 56.48,50.00 56.48,66.67 C56.48,83.33 54.43,83.33 54.43,100.00 C54.43,116.67 51.30,116.67 51.30,133.33 C51.30,150.00 47.85,150.00 47.85,166.67 C47.85,183.33 44.93,183.33 44.93,200.00 C44.93,216.67 43.24,216.67 43.24,233.33 C43.24,250.00 43.20,250.00 43.20,266.67 C43.20,283.33 44.81,283.33 44.81,300.00 C44.81,316.67 47.69,316.67 47.69,333.33 C47.69,350.00 51.13,350.00 51.13,366.67 C51.13,383.33 54.30,383.33 54.30,400.00 C54.30,416.67 56.42,416.67 56.42,433.33 C56.42,450.00 56.97,450.00 56.97,466.67 C56.97,483.33 55.83,483.33 55.83,500.00 C55.83,516.67 53.27,516.67 53.27,533.33 C53.27,550.00 49.91,550.00 49.91,566.67 C49.91,583.33 46.58,583.33 46.58,600.00 C46.58,616.67 44.07,616.67 44.07,633.33 C44.07,650.00 43.01,650.00 43.01,666.67 C43.01,683.33 43.66,683.33 43.66,700.00 C43.66,716.67 45.84,716.67 45.84,733.33 C45.84,750.00 49.04,750.00 49.04,766.67 C49.04,783.33 52.48,783.33 52.48,800.00 L100.00,800.00 L100.00,0 Z"
          className="fill-brand-primary"
          fillOpacity={0.5}
        />
        <path
          d="M58.70,0.00 C58.70,16.67 57.31,16.67 57.31,33.33 C57.31,50.00 55.11,50.00 55.11,66.67 C55.11,83.33 52.65,83.33 52.65,100.00 C52.65,116.67 50.51,116.67 50.51,133.33 C50.51,150.00 49.22,150.00 49.22,166.67 C49.22,183.33 49.10,183.33 49.10,200.00 C49.10,216.67 50.17,216.67 50.17,233.33 C50.17,250.00 52.17,250.00 52.17,266.67 C52.17,283.33 54.62,283.33 54.62,300.00 C54.62,316.67 56.92,316.67 56.92,333.33 C56.92,350.00 58.50,350.00 58.50,366.67 C58.50,383.33 58.99,383.33 58.99,400.00 C58.99,416.67 58.27,416.67 58.27,433.33 C58.27,450.00 56.50,450.00 56.50,466.67 C56.50,483.33 54.12,483.33 54.12,500.00 C54.12,516.67 51.72,516.67 51.72,533.33 C51.72,550.00 49.87,550.00 49.87,566.67 C49.87,583.33 49.02,583.33 49.02,600.00 C49.02,616.67 49.39,616.67 49.39,633.33 C49.39,650.00 50.88,650.00 50.88,666.67 C50.88,683.33 53.13,683.33 53.13,700.00 C53.13,716.67 55.59,716.67 55.59,733.33 C55.59,750.00 57.67,750.00 57.67,766.67 C57.67,783.33 58.85,783.33 58.85,800.00 L100.00,800.00 L100.00,0 Z"
          className="fill-brand-primary"
        />
      </svg>
    </div>
  );
}

export function AuthSplitLayout({ logoUrl, wide = false, children }: AuthSplitLayoutProps) {
  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* বাম: ফর্ম */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:order-2 lg:w-[46%] lg:px-16 xl:px-20">
        <div className={`relative z-20 mx-auto w-full ${wide ? "max-w-lg" : "max-w-sm"}`}>
          <div className="mb-8 lg:hidden">
            <BrandLogoLockup logoUrl={logoUrl} size={36} tone="dark" />
          </div>
          {children}

          {/* কম্প্যাক্ট মোবাইল ফিচার-স্ট্রিপ (১২ আগস্ট ২০২৬, Option A) —
              ডান ব্র্যান্ড প্যানেল lg-এর নিচে হিডেন থাকায় মোবাইল ইউজাররা
              (যারাই বেশিরভাগ) কখনো ভ্যালু-প্রপোজিশন দেখতেন না। কিন্তু
              লগইন পেজে প্রতিদিন বারবার ব্যবহারকারী আসেন, তাই আলাদা
              "Welcome → Next" স্টেপ যোগ করে ঘর্ষণ বাড়ানো হয়নি — বরং এই
              ৩-আইটেমের ছোট স্ট্রিপ ফর্মের ঠিক নিচে বসানো হলো, কোনো এক্সট্রা
              ট্যাপ/স্টেপ ছাড়াই। */}
          <div className="mt-8 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-6 lg:hidden">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <WifiOff className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              </span>
              <p className="mt-1.5 text-[11px] font-medium leading-tight text-neutral-600">
                অফলাইনেও কাজ করে
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <Globe className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              </span>
              <p className="mt-1.5 text-[11px] font-medium leading-tight text-neutral-600">
                সম্পূর্ণ বাংলায়
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <ShieldCheck className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              </span>
              <p className="mt-1.5 text-[11px] font-medium leading-tight text-neutral-600">
                ৩ দিন ফ্রি ট্রায়াল
              </p>
            </div>
          </div>
        </div>
      </div>

      <WaveDivider />

      {/* ডান: ব্র্যান্ড প্যানেল (lg+ স্ক্রিনে) */}
      <div className="relative hidden overflow-hidden bg-brand-primary lg:order-1 lg:flex lg:w-[54%] lg:flex-col lg:justify-between lg:p-14">
        {/* সূক্ষ্ম ডেকোরেটিভ প্যাটার্ন — perforated/dotted রেখা, প্রিন্টিং-প্রেস থিমের ধারাবাহিকতা */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: "radial-gradient(circle, #FFFFFF 1.4px, transparent 1.4px)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#8FC5FF]/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-20">
          <BrandLogoLockup logoUrl={logoUrl} size={44} tone="light" />
        </div>

        <div className="relative z-20 max-w-md">
          <h2 className="text-3xl font-bold leading-snug text-white">
            আপনার প্রিন্টিং ব্যবসার জন্য সম্পূর্ণ ডিজিটাল সমাধান
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            অর্ডার, পেমেন্ট, স্টাফ কমিশন, স্টক — সবকিছু এক জায়গায়, বাংলায়,
            ইন্টারনেট ছাড়াও কাজ করে।
          </p>

          <div className="mt-9 space-y-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12">
                <WifiOff className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-white">অফলাইনেও কাজ করে</p>
                <p className="text-xs text-white/65">নেট চলে গেলেও অর্ডার নেওয়া থামবে না</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12">
                <Globe className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-white">সম্পূর্ণ বাংলায়</p>
                <p className="text-xs text-white/65">মেনু, চালান, বার্তা — সব আপনার ভাষায়</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12">
                <ShieldCheck className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-white">৩ দিন ফ্রি ট্রায়াল</p>
                <p className="text-xs text-white/65">কোনো কার্ড ছাড়াই, কোনো বাধ্যবাধকতা নেই</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-20 text-xs text-white/45">© AL-IHSAN PrintERP</p>
      </div>
    </div>
  );
}
