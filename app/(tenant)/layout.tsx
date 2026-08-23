"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuthListener } from "@/lib/hooks/use-auth-listener";
import { useAuthStore } from "@/lib/stores/auth-store";
import { db } from "@/lib/firebase/client";
import { TenantShell } from "@/components/tenant/layout/tenant-shell";
import { getPlatformSettingsOnce } from "@/lib/firebase/platform-settings";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/platform-settings";
import type { Timestamp } from "firebase/firestore";

interface TenantDoc {
  name: string;
  logoUrl: string;
  subscriptionStatus: "active" | "suspended" | "expired" | "trial";
  isTrial: boolean;
  trialEndsAt: Timestamp | null;
  planFeatures: Record<string, boolean>;
  settings?: { language?: "bn" | "en" };
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  useAuthListener();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const [tenantDoc, setTenantDoc] = useState<TenantDoc | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [trialContactPhone, setTrialContactPhone] = useState(DEFAULT_PLATFORM_SETTINGS.supportPhone);

  // Module SA-05: contact number is now Super-Admin-managed
  // (/platform_settings/general), no longer a hardcoded constant.
  useEffect(() => {
    getPlatformSettingsOnce()
      .then((s) => setTrialContactPhone(s.supportPhone))
      .catch(() => {
        /* keep the default already shown */
      });
  }, []);

  // FIX (bugfixed session): this app has no `/bn`/`/en` URL prefix — locale
  // comes from the `lang` cookie via next-intl's request config. The old
  // `pathname.startsWith("/en")` check always evaluated to `false` (no such
  // route ever existed), so the navbar's active-language indicator and any
  // locale-aware redirect below always silently assumed Bengali regardless
  // of the user's actual toggle choice. `useLocale()` reflects the real
  // server-negotiated locale for this request.
  const locale = useLocale() as "bn" | "en";

  // Redirect unauthenticated or unauthorized users.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const role = user.claims.role;
    if (role !== "tenant_admin" && role !== "branch_manager" && role !== "commission_staff" && role !== "regular_staff") {
      router.replace("/login");
    }
  }, [user, isAuthLoading, router, locale]);

  // Subscribe to the tenant document to react live to subscriptionStatus changes
  // (e.g. trial expiry, suspension) per blueprint section 11.3.
  useEffect(() => {
    const tenantId = user?.claims.tenantId;
    if (!tenantId) {
      setTenantLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "tenants", tenantId),
      (snapshot) => {
        const data = snapshot.data() as TenantDoc | undefined;
        if (data) setTenantDoc(data);
        setTenantLoading(false);
      },
      () => setTenantLoading(false)
    );

    return () => unsubscribe();
  }, [user?.claims.tenantId]);

  useEffect(() => {
    if (tenantLoading || !tenantDoc) return;

    if (tenantDoc.subscriptionStatus === "suspended") {
      router.replace("/suspended");
      return;
    }

    const isExpiredTrial =
      tenantDoc.isTrial &&
      tenantDoc.trialEndsAt &&
      tenantDoc.trialEndsAt.toDate().getTime() < Date.now();

    if (tenantDoc.subscriptionStatus === "expired" || isExpiredTrial) {
      router.replace("/trial-expired");
    }
  }, [tenantDoc, tenantLoading, router, locale]);

  if (isAuthLoading || tenantLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-primary" />
      </div>
    );
  }

  return (
    <TenantShell
      locale={locale}
      role={user.claims.role}
      planFeatures={tenantDoc?.planFeatures ?? {}}
      isTrial={tenantDoc?.isTrial ?? false}
      trialEndsAt={tenantDoc?.trialEndsAt ?? null}
      trialContactPhone={trialContactPhone}
      tenantName={tenantDoc?.name}
      tenantLogoUrl={tenantDoc?.logoUrl}
    >
      {children}
    </TenantShell>
  );
}
