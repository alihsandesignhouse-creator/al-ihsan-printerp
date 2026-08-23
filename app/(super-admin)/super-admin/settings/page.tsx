"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Settings, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { subscribePlatformSettings } from "@/lib/firebase/platform-settings";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/lib/types/platform-settings";
import { ContactSettingsForm } from "@/components/super-admin/settings/contact-settings-form";
import { NotificationGatewayPanel } from "@/components/super-admin/settings/notification-gateway-panel";
import { CrossTenantAuditLogTab } from "@/components/super-admin/settings/cross-tenant-audit-log-tab";

/**
 * app/(super-admin)/super-admin/settings/page.tsx — Module SA-05
 * (সিস্টেম সেটিং).
 *
 * Scope note (see MODULE_README.md for the full write-up): the blueprint's
 * SA-05 also lists "SMS/Email গেটওয়ে কনফিগারেশন" and "সিস্টেম SMS/Email
 * টেমপ্লেট" — in this codebase the gateway credentials are Netlify
 * env-var secrets (never Firestore-editable, see the গেটওয়ে tab's own
 * comment) and there is no platform-wide trial-lifecycle notification
 * send path to attach a "system template" editor to (tenant-level
 * notification templates already exist from T-09 and are unrelated). This
 * page therefore covers: যোগাযোগ সেটিং (contact info shown on public
 * pages), নোটিফিকেশন গেটওয়ে (status + test-send), and অডিট লগ
 * (cross-tenant activity feed).
 */
export default function SuperAdminSettingsPage() {
  const t = useTranslations("sa");

  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const unsub = subscribePlatformSettings(
      (data) => {
        setSettings(data);
        setIsLoading(false);
      },
      () => {
        setError(true);
        setIsLoading(false);
      }
    );
    return unsub;
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{t("nav.settings")}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{t("settingsPage.subtitle")}</p>
        </div>
      </div>

      <Tabs defaultValue="contact">
        <TabsList>
          <TabsTrigger value="contact">{t("settingsPage.tabs.contact")}</TabsTrigger>
          <TabsTrigger value="gateway">{t("settingsPage.tabs.gateway")}</TabsTrigger>
          <TabsTrigger value="auditLog">{t("settingsPage.tabs.auditLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="rounded-xl border border-neutral-200 bg-white p-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("common.loading")}
            </div>
          ) : error ? (
            <p className="text-sm text-status-danger">{t("errors.fetchFailed")}</p>
          ) : (
            <ContactSettingsForm settings={settings} />
          )}
        </TabsContent>

        <TabsContent value="gateway" className="rounded-xl border border-neutral-200 bg-white p-5">
          <NotificationGatewayPanel />
        </TabsContent>

        <TabsContent value="auditLog" className="rounded-xl border border-neutral-200 bg-white p-5">
          <CrossTenantAuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
