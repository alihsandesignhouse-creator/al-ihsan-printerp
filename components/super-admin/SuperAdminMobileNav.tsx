'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NAV_ITEMS } from './SuperAdminSidebar';

/**
 * AUDIT FIX (Critical Issue #1, mobile follow-through): hiding the fixed
 * 256px sidebar below `lg:` (see SuperAdminSidebar.tsx) stops it from
 * covering the page, but on its own that would leave mobile/tablet
 * super-admin users with no navigation at all. Only 5 items and no
 * role/plan filtering here (this panel is super_admin-only), so — unlike
 * the tenant side's larger nav — all 5 fit directly in a bottom nav with
 * no separate "more" menu needed.
 */
export function SuperAdminMobileNav() {
  const t = useTranslations('sa.nav');
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              active ? 'text-brand-primary' : 'text-neutral-400'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
