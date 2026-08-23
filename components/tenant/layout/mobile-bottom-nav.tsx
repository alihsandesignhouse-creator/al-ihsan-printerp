"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, ClipboardList, PlusCircle, Users, Menu } from "lucide-react";
import { MobileMoreMenu } from "./mobile-more-menu";
import type { UserRole } from "@/lib/types/auth";

interface MobileBottomNavProps {
  role: UserRole;
  planFeatures: Record<string, boolean>;
}

/**
 * Mobile bottom navigation per blueprint section 14.9:
 * [Home] [ClipboardList] [Plus (large)] [Users] [Menu]
 *
 * AUDIT FIX (Critical issue #2): "Menu" was a dead `<Link href="/dashboard/menu">`
 * — that route never existed, so every section beyond these four icons was
 * unreachable on mobile/tablet. The blueprint always intended this icon to
 * open a menu, not navigate to a page — it's now a button that opens
 * MobileMoreMenu (a dialog listing every remaining sidebar section, filtered
 * by the same role/plan rules as the desktop Sidebar).
 */
export function MobileBottomNav({ role, planFeatures }: MobileBottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname.endsWith("/dashboard");
    return pathname.includes(href);
  }

  const linkClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
      active ? "text-brand-primary" : "text-neutral-400"
    }`;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {/* বাগ-ফিক্স (২১ আগস্ট ২০২৬, মোবাইল-রেসপন্সিভ অডিট): নচ/হোম-ইন্ডিকেটর
            থাকা আইফোনে (iPhone X ও পরবর্তী) এই ফিক্সড bottom-nav আগে সরাসরি
            স্ক্রিনের একদম নিচের কিনারায় বসত — হোম-ইন্ডিকেটরের সোয়াইপ-এরিয়ার
            সাথে ঘেঁষে থাকত, দেখতে অস্বস্তিকর ও ট্যাপ করতে চাপা লাগত।
            env(safe-area-inset-bottom) দিয়ে ডিভাইস অনুযায়ী প্রয়োজনীয় নিচের
            padding স্বয়ংক্রিয়ভাবে যোগ হবে (Android/পুরনো iPhone-এ এই মান ০,
            তাই ওখানে কোনো পরিবর্তন দেখা যাবে না)। tenant-shell.tsx-এর
            main-এ আগে থেকেই থাকা pb-20 (৮০px) বাফার এই অতিরিক্ত padding-কে
            যথেষ্ট মার্জিনসহ কভার করে, তাই কনটেন্ট নেভ-বারের আড়ালে ঢাকা
            পড়বে না। */}
        <Link href="/dashboard" className={linkClass(isActive("/dashboard") && pathname.split("/").length <= 3)}>
          <Home className="h-5 w-5" aria-hidden="true" />
          {t("nav.dashboard")}
        </Link>
        <Link href="/dashboard/orders" className={linkClass(isActive("/dashboard/orders"))}>
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          {t("nav.orders")}
        </Link>
        <Link
          href="/dashboard/orders/new"
          className="flex flex-1 flex-col items-center justify-center"
          title={t("nav.newOrder")}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm">
            <PlusCircle className="h-6 w-6" aria-hidden="true" />
          </span>
        </Link>
        <Link href="/dashboard/customers" className={linkClass(isActive("/dashboard/customers"))}>
          <Users className="h-5 w-5" aria-hidden="true" />
          {t("nav.customers")}
        </Link>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={linkClass(moreOpen)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          {t("nav.menu")}
        </button>
      </nav>

      <MobileMoreMenu open={moreOpen} onOpenChange={setMoreOpen} role={role} planFeatures={planFeatures} />
    </>
  );
}
