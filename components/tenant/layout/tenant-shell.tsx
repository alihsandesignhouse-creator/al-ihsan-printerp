"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopNavbar } from "./top-navbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { TrialBanner } from "./trial-banner";
import { useUIStore } from "@/lib/stores/ui-store";
import { useConnectionMonitor } from "@/lib/hooks/use-connection-monitor";
import { computeTrialStatus } from "@/lib/hooks/use-trial-status";
import type { UserRole } from "@/lib/types/auth";
import type { Timestamp } from "firebase/firestore";

interface TenantShellProps {
  children: ReactNode;
  locale: "bn" | "en";
  role: UserRole;
  planFeatures: Record<string, boolean>;
  isTrial: boolean;
  trialEndsAt: Timestamp | null;
  trialContactPhone: string;
  tenantName?: string;
  tenantLogoUrl?: string;
}

/**
 * Layout structure (sticky header approach):
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  [TrialBanner — sticky, full width, z-50]           │  ← only when trial
 * ├──────────────┬──────────────────────────────────────┤
 * │              │  [TopNavbar — sticky, z-40]           │
 * │   Sidebar    ├──────────────────────────────────────┤
 * │  (sticky,    │  <main> — scrollable content area     │
 * │   h-screen,  │                                       │
 * │   overflow-y │                                       │
 * │   -auto)     │                                       │
 * └──────────────┴──────────────────────────────────────┘
 *
 * The sidebar uses `sticky top-0 h-screen` so it stays in view as <main>
 * scrolls. The TopNavbar uses `sticky top-0 z-40` within the right column.
 * When the TrialBanner is present (z-50, sticky top-0) it sits above both
 * and pushes the content area down naturally — no calc() hacks required
 * because the sidebar's sticky positioning is relative to its scroll
 * container (the flex row), not the viewport.
 */
export function TenantShell({
  children,
  locale,
  role,
  planFeatures,
  isTrial,
  trialEndsAt,
  trialContactPhone,
  tenantName,
  tenantLogoUrl,
}: TenantShellProps) {
  useConnectionMonitor();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  const trialStatus = isTrial ? computeTrialStatus(trialEndsAt) : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Trial banner — sticky at the very top, above sidebar & navbar */}
      {trialStatus && (
        <div className="sticky top-0 z-50 w-full">
          <TrialBanner
            daysLeft={trialStatus.daysLeft}
            level={trialStatus.level}
            contactPhone={trialContactPhone}
          />
        </div>
      )}

      {/* Main content row: sidebar (left) + topbar+page (right) */}
      <div className="flex flex-1">
        <Sidebar
          role={role}
          planFeatures={planFeatures}
          collapsed={sidebarCollapsed}
          tenantName={tenantName}
          tenantLogoUrl={tenantLogoUrl}
        />

        {/* Right column: sticky topbar + scrollable main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNavbar locale={locale} />
          <main className="flex-1 bg-neutral-50 p-4 pb-20 lg:pb-4">{children}</main>
        </div>
      </div>

      <MobileBottomNav role={role} planFeatures={planFeatures} />
    </div>
  );
}
