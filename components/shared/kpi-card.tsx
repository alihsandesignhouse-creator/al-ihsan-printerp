"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";

/**
 * components/shared/kpi-card.tsx
 *
 * Design-system audit fix (৫ আগস্ট ২০২৬): এতদিন `components/super-admin/KpiCard.tsx`
 * ও `components/tenant/dashboard/kpi-card.tsx` — দুটো সম্পূর্ণ আলাদা,
 * ডুপ্লিকেট কম্পোনেন্ট ছিল (ভিন্ন props নাম, ভিন্ন প্যাডিং, ভিন্ন বর্ডার
 * শেড; Tenant ভার্সনে skeleton/locked স্টেট ছিল, Super Admin-এ ছিল না)।
 * এখন থেকে দুটো অ্যাপই এই একটাই শেয়ার্ড কম্পোনেন্ট ব্যবহার করে।
 *
 * দুটো পুরনো API-ই সাপোর্ট করা হয়েছে যাতে কোনো call site জোর করে সংকুচিত
 * না হয়:
 * - Tenant-স্টাইল: `accentColor` (৫টা নির্দিষ্ট সিমান্টিক রং) + `href`
 *   (Next.js `<Link>` নেভিগেশন) + `locked`/`lockedLabel` + `isLoading`
 * - Super-Admin-স্টাইল: সরাসরি `iconColor`+`bgColor` (স্বাধীন যেকোনো
 *   Tailwind ক্লাস — Super Admin ১০টা call site-এ ৭ রকম রং ব্যবহার করে,
 *   ৫-মানের accentColor enum-এ জোর করে গুঁজে দিলে ভিজ্যুয়াল distinction
 *   হারিয়ে যেত) + `onClick` (router.push কলব্যাক)
 *
 * `iconColor`+`bgColor` দেওয়া থাকলে সেটাই ব্যবহার হয়; না থাকলে
 * `accentColor` (ডিফল্ট "primary") থেকে lookup হয়।
 *
 * ⚠️ ভিজ্যুয়াল পরিবর্তন (শুধু Super Admin-এ, ইচ্ছাকৃত): এই মার্জে
 * Tenant অ্যাপের লেআউট কনভেনশন (আইকন উপরে, তার নিচে label+value স্ট্যাক
 * করা, প্যাডিং p-4, বর্ডার border-neutral-200) প্রমিত হিসেবে বেছে নেওয়া
 * হয়েছে — Super Admin-এর আগের লেআউট ছিল ভিন্ন (label+value বামে, আইকন
 * বক্স ডানে পাশাপাশি, প্যাডিং p-5, বর্ডার border-neutral-100)। এটা
 * hex→token সোয়াপের মতো "শূন্য ভিজ্যুয়াল পরিবর্তন" না — Super Admin-এর
 * KPI কার্ডগুলো এখন দেখতে সামান্য ভিন্ন হবে (Tenant-এর মতো), যদিও একই
 * তথ্য একইভাবে বোঝা যাবে।
 */

export type KpiAccentColor = "primary" | "success" | "warning" | "danger" | "info";

const ACCENT_STYLES: Record<KpiAccentColor, { bg: string; icon: string }> = {
  primary: { bg: "bg-blue-50", icon: "text-brand-primary" },
  success: { bg: "bg-emerald-50", icon: "text-emerald-600" },
  warning: { bg: "bg-amber-50", icon: "text-amber-600" },
  danger: { bg: "bg-red-50", icon: "text-red-600" },
  info: { bg: "bg-sky-50", icon: "text-sky-600" },
};

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  subtitle?: string;
  /** ৫টা সিমান্টিক রঙের একটা বেছে নিন — না দিলে "primary"। iconColor/bgColor দেওয়া থাকলে এটা উপেক্ষা করা হয়। */
  accentColor?: KpiAccentColor;
  /** স্বাধীন Tailwind ক্লাস — accentColor-এর বদলে সরাসরি রং নিয়ন্ত্রণ (Super Admin স্টাইল)। */
  iconColor?: string;
  bgColor?: string;
  /** দেওয়া থাকলে পুরো কার্ড <Link> হয়ে যাবে। */
  href?: string;
  /** দেওয়া থাকলে পুরো কার্ড ক্লিকযোগ্য <div> হয়ে যাবে (Link-এর বদলে)। href ও onClick একসাথে দিলে href অগ্রাধিকার পাবে। */
  onClick?: () => void;
  locked?: boolean;
  lockedLabel?: string;
  isLoading?: boolean;
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="h-9 w-9 animate-pulse rounded-lg bg-neutral-100" />
      <div className="mt-3 h-3 w-20 animate-pulse rounded bg-neutral-100" />
      <div className="mt-2 h-6 w-24 animate-pulse rounded bg-neutral-100" />
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  subtitle,
  accentColor = "primary",
  iconColor,
  bgColor,
  href,
  onClick,
  locked = false,
  lockedLabel,
  isLoading = false,
}: KpiCardProps) {
  if (isLoading) return <KpiCardSkeleton />;

  const resolvedIconColor = iconColor ?? ACCENT_STYLES[accentColor].icon;
  const resolvedBgColor = bgColor ?? ACCENT_STYLES[accentColor].bg;
  const isInteractive = !locked && (!!href || !!onClick);

  const content = (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-4 transition-shadow ${
        isInteractive ? "cursor-pointer hover:shadow-sm" : ""
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${resolvedBgColor}`}>
        <Icon className={`h-5 w-5 ${resolvedIconColor}`} aria-hidden="true" />
      </div>
      <p className="mt-3 text-xs font-medium text-neutral-500">{label}</p>
      {locked ? (
        <div className="mt-1 flex items-center gap-1.5 text-sm text-neutral-400">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{lockedLabel}</span>
        </div>
      ) : (
        <>
          <p className="mt-1 break-words text-xl font-semibold text-neutral-900">{value}</p>
          {subtitle && <p className="mt-1 break-words text-xs text-neutral-400">{subtitle}</p>}
        </>
      )}
    </div>
  );

  if (locked) {
    return <div className="cursor-not-allowed opacity-80">{content}</div>;
  }
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <div onClick={onClick} role="button" tabIndex={0}>
        {content}
      </div>
    );
  }
  return content;
}
