'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  Settings,
  Printer,
} from 'lucide-react';
import { SuperAdminUserMenu } from './SuperAdminUserMenu';

export interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/super-admin/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
  { href: '/super-admin/tenants',   icon: Users,           labelKey: 'tenants'   },
  { href: '/super-admin/packages',  icon: Package,         labelKey: 'packages'  },
  { href: '/super-admin/reports',   icon: BarChart3,       labelKey: 'reports'   },
  { href: '/super-admin/settings',  icon: Settings,        labelKey: 'settings'  },
];

export function SuperAdminSidebar() {
  const t = useTranslations('sa.nav');
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-brand-primaryDeep lg:flex">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/15">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <Printer className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">AL-IHSAN PrintERP</p>
            <p className="text-white/70 text-[10px]">{t('superAdminLabel')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                isActive
                  ? 'bg-white/15 text-white border-l-[3px] border-white pl-[9px]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* বাগ-ফিক্স (২১ আগস্ট ২০২৬): আগে এখানে খালি ইমেইল-টেক্সট + আলাদা
          Logout বাটন প্লেইনভাবে বসানো ছিল — এখন মোবাইল টপ-বারের সাথে
          সামঞ্জস্যপূর্ণ একই অ্যাভাটার+ড্রপডাউন কম্পোনেন্ট (dark variant,
          ড্রপডাউন উপরের দিকে খোলে যেহেতু এটা স্ক্রিনের একদম নিচে)। */}
      <div className="px-3 py-3 border-t border-white/15">
        <SuperAdminUserMenu variant="dark" />
      </div>
    </aside>
  );
}
