"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Clock,
  Users,
  CreditCard,
  Package,
  UserCog,
  BarChart3,
  Settings,
  Info,
  Calculator,
  TrendingUp,
  Receipt,
  FileText,
  Boxes,
  Warehouse,
  ExternalLink,
  Wallet,
  HandCoins,
  Percent,
  History,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/types/auth";
import type { PlanFeatures } from "@/lib/types/tenant";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  standardPlus?: boolean;
  /**
   * নির্দিষ্ট ফিচার-কী দিয়ে সরাসরি গেট করা (audit #৭ সংযোজন)। দেওয়া থাকলে
   * নিচের `standardPlus` হিউরিস্টিকের বদলে সরাসরি `planFeatures[featureKey]`
   * চেক হয় — যেমন outsourceTracking আসলে প্রিমিয়াম-only হলেও আগে ভুলভাবে
   * standardPlus হিউরিস্টিক দিয়ে গেট করা হতো (স্ট্যান্ডার্ড টেন্যান্টও লিংক
   * দেখতে পেতেন, তারপর পেজে গিয়ে locked দেখতেন — বিভ্রান্তিকর)।
   */
  featureKey?: keyof PlanFeatures;
}

export interface NavSection {
  titleKey: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "nav.mainMenu",
    items: [
      { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["tenant_admin", "branch_manager", "commission_staff", "regular_staff"] },
      { key: "nav.orders", href: "/dashboard/orders", icon: ClipboardList, roles: ["tenant_admin", "branch_manager", "commission_staff", "regular_staff"] },
      { key: "nav.newOrder", href: "/dashboard/orders/new", icon: PlusCircle, roles: ["tenant_admin", "branch_manager", "commission_staff"] },
      { key: "nav.pendingWork", href: "/dashboard/pending-work", icon: Clock, roles: ["tenant_admin", "branch_manager", "commission_staff", "regular_staff"] },
      { key: "nav.customers", href: "/dashboard/customers", icon: Users, roles: ["tenant_admin", "branch_manager", "commission_staff", "regular_staff"] },
      { key: "nav.payments", href: "/dashboard/payments", icon: CreditCard, roles: ["tenant_admin", "branch_manager", "commission_staff"] },
      { key: "nav.items", href: "/dashboard/items", icon: Package, roles: ["tenant_admin", "branch_manager"] },
      { key: "nav.myCollection", href: "/dashboard/my-collection", icon: HandCoins, roles: ["commission_staff"] },
    ],
  },
  {
    titleKey: "nav.advancedMenu",
    items: [
      { key: "nav.costing", href: "/dashboard/costing", icon: Calculator, roles: ["tenant_admin", "branch_manager"], standardPlus: true },
      { key: "nav.commission", href: "/dashboard/commission", icon: TrendingUp, roles: ["tenant_admin", "branch_manager"], standardPlus: true },
      { key: "nav.expenses", href: "/dashboard/expenses", icon: Receipt, roles: ["tenant_admin", "branch_manager"], standardPlus: true },
      { key: "nav.myCommission", href: "/dashboard/my-commission", icon: Percent, roles: ["commission_staff"], standardPlus: true },
      { key: "nav.quotations", href: "/dashboard/quotations", icon: FileText, roles: ["tenant_admin", "branch_manager"], standardPlus: true },
      { key: "nav.stock", href: "/dashboard/stock", icon: Boxes, roles: ["tenant_admin", "branch_manager"], standardPlus: true },
      { key: "nav.suppliers", href: "/dashboard/suppliers", icon: Warehouse, roles: ["tenant_admin", "branch_manager"], standardPlus: true },
      { key: "nav.outsource", href: "/dashboard/outsource", icon: ExternalLink, roles: ["tenant_admin"], featureKey: "outsourceTracking" },
      { key: "nav.zakat", href: "/dashboard/zakat", icon: Wallet, roles: ["tenant_admin"] },
    ],
  },
  {
    titleKey: "nav.adminMenu",
    items: [
      { key: "nav.reports", href: "/dashboard/reports", icon: BarChart3, roles: ["tenant_admin", "branch_manager"] },
      { key: "nav.users", href: "/dashboard/users", icon: UserCog, roles: ["tenant_admin"] },
      { key: "nav.auditLog", href: "/dashboard/audit-log", icon: History, roles: ["tenant_admin"] },
      { key: "nav.settings", href: "/dashboard/settings", icon: Settings, roles: ["tenant_admin"] },
      // "নির্মাতার পরিচিতি" (১৩ আগস্ট ২০২৬, ১৪ আগস্ট ২০২৬-এ href ফিক্স) —
      // লগইন ছাড়া দেখার জন্য /about পাবলিক পেজও আলাদাভাবে আছে
      // (middleware.ts PUBLIC_PATHS, login/signup/trial-expired ফুটার
      // থেকে লিংক করা)। কিন্তু লগইন-করা অবস্থায় সাইডবার থেকে ক্লিক করলে
      // এখন /dashboard/about-এ যায় (আগে সরাসরি /about-এ যেত, যা
      // TenantShell-এর বাইরে একটা standalone পেজ বলে পুরো সাইডবার/টপ-
      // নেভবার শেল থেকে বেরিয়ে যেত)। সব রোলে দৃশ্যমান — সংবেদনশীল কিছু
      // না, প্যাকেজ/ফিচার-গেট নেই।
      {
        key: "nav.about",
        href: "/dashboard/about",
        icon: Info,
        roles: ["tenant_admin", "branch_manager", "commission_staff", "regular_staff"],
      },
    ],
  },
];

interface SidebarProps {
  role: UserRole;
  planFeatures: Record<string, boolean>;
  collapsed: boolean;
  tenantName?: string;
  tenantLogoUrl?: string;
}

export function isNavItemVisible(item: NavItem, role: UserRole, planFeatures: Record<string, boolean>): boolean {
  if (!item.roles.includes(role)) return false;
  if (item.featureKey) return Boolean(planFeatures[item.featureKey]);
  if (item.standardPlus && !planFeatures.multiBranch && !planFeatures.costCalculator) {
    // Hide standard+ items entirely for basic-tier tenants rather than showing locked state
    // in the sidebar (locked state is reserved for dashboard KPI cards).
    return Boolean(planFeatures.standardPlus);
  }
  return true;
}

export function Sidebar({ role, planFeatures, collapsed, tenantName, tenantLogoUrl }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();

  function isVisible(item: NavItem): boolean {
    return isNavItemVisible(item, role, planFeatures);
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.includes(href);
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-brand-primaryDeep transition-all duration-200 lg:flex ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/15 px-4">
        {tenantLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenantLogoUrl}
            alt={tenantName ?? ""}
            className="h-8 w-8 shrink-0 rounded object-contain"
          />
        ) : (
          <Building2 className="h-6 w-6 shrink-0 text-white/70" aria-hidden="true" />
        )}
        {!collapsed && (
          <span className="min-w-0 truncate text-sm font-semibold text-white" title={tenantName}>
            {tenantName || ""}
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.titleKey}>
              {!collapsed && (
                <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                  {t(section.titleKey)}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? t(item.key) : undefined}
                      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "border-l-[3px] border-white bg-white/15 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4.5 w-4.5 shrink-0 ${active ? "text-white" : "text-white/70"}`}
                        aria-hidden="true"
                      />
                      {!collapsed && <span className="truncate">{t(item.key)}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
