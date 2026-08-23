"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, Phone, Mail, LogOut } from "lucide-react";
import { signOut } from "@/lib/firebase/auth";
import { getPlatformSettingsOnce } from "@/lib/firebase/platform-settings";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/lib/types/platform-settings";
import { AuthSplitLayout } from "@/components/shared/auth-split-layout";

/**
 * প্রিমিয়াম auth-পেজ রিডিজাইন সম্প্রসারণ (৯ আগস্ট ২০২৬): এই পেজটা একটা
 * সাধারণ, সংকীর্ণ, একক-কার্ড পেজ (trial-expired-এর মতো wide প্যাকেজ-গ্রিড
 * না) — তাই Login/Signup-এর মতোই AuthSplitLayout শেল সরাসরি মানিয়ে যায়,
 * প্ল্যাটফর্ম লোগো + সামঞ্জস্যপূর্ণ ভিজ্যুয়াল ভাষা স্বয়ংক্রিয়ভাবে পেয়ে যায়।
 */
export default function SuspendedPage() {
  const t = useTranslations();
  const router = useRouter();
  const [contact, setContact] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

  // Module SA-05: contact info ও logo এখন Super-Admin-managed
  // (/platform_settings/general) — public read, auth লাগে না।
  useEffect(() => {
    getPlatformSettingsOnce()
      .then(setContact)
      .catch(() => {
        /* keep the default already shown */
      });
  }, []);

  async function handleLogout() {
    await signOut();
    // FIX (bugfixed session): this app has no `/bn`/`/en` URL prefix — the
    // old `/${locale}/login` redirect always pointed at the non-existent
    // `/bn/login` route (404). The real login route is just `/login`.
    router.push("/login");
  }

  return (
    <AuthSplitLayout logoUrl={contact.logoUrl}>
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <Ban className="h-6 w-6 text-amber-600" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-neutral-900">{t("suspended.title")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("suspended.message")}</p>

        <div className="mt-6 space-y-2">
          <a
            href={`tel:${contact.supportPhone}`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-primary text-sm font-medium text-brand-primary transition-colors hover:bg-blue-50"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {contact.supportPhone}
          </a>
          <a
            href={`mailto:${contact.supportEmail}`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {contact.supportEmail}
          </a>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 text-sm font-medium text-neutral-600 hover:bg-neutral-200"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t("suspended.logoutBtn")}
        </button>
      </div>
    </AuthSplitLayout>
  );
}
