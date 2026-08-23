"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NAV_SECTIONS, isNavItemVisible } from "./sidebar";
import type { UserRole } from "@/lib/types/auth";

interface MobileMoreMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
  planFeatures: Record<string, boolean>;
}

/**
 * Blueprint section 14.9 always intended the bottom nav's "Menu" icon to
 * open a menu, not navigate to a literal `/dashboard/menu` page (one never
 * existed). That left every section beyond Home/Orders/New Order/Customers
 * — Payments, Items, Costing, Commission, Expenses, Quotations, Stock,
 * Suppliers, Outsource, Zakat, Reports, Users, Audit Log, Settings, Profile
 * — completely unreachable on mobile/tablet (<1024px, where the desktop
 * Sidebar is hidden). This reuses the desktop Sidebar's exact NAV_SECTIONS
 * data and isNavItemVisible role/plan filtering, so the two navs can never
 * drift out of sync — adding a section to one adds it to both.
 *
 * বাগ-ফিক্স (২১ আগস্ট ২০২৬, ব্যবহারকারীর ফিডব্যাক): আগে এটা `Dialog`
 * (মাঝখানে popup) ব্যবহার করত, যেটা "professional" লাগছিল না। এখন
 * `Sheet` — ডেস্কটপ সাইডবারের অবস্থানের সাথে মিলিয়ে বাম দিক থেকে
 * স্লাইড করে বের হয়, বন্ধ করলে আবার পাশে স্লাইড করে ঢুকে যায়।
 */
export function MobileMoreMenu({ open, onOpenChange, role, planFeatures }: MobileMoreMenuProps) {
  const t = useTranslations();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0">
        <SheetHeader>
          <SheetTitle>{t("nav.menu")}</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => isNavItemVisible(item, role, planFeatures));
            if (items.length === 0) return null;
            return (
              <div key={section.titleKey}>
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {t(section.titleKey)}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
                        {t(item.key)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
