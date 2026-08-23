"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShieldCheck, MessageCircle, Phone, Mail, LogOut } from "lucide-react";
import { PackageCard } from "@/components/shared/package-card";
import { BrandLogoLockup } from "@/components/shared/brand-logo";
import { signOut } from "@/lib/firebase/auth";
import { getSubscriptionPlansOnce } from "@/lib/firebase/subscription-plans";
import { getPlatformSettingsOnce } from "@/lib/firebase/platform-settings";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/lib/types/platform-settings";
import type { SubscriptionPlanCatalogEntry } from "@/lib/types/subscription-plan";

export default function TrialExpiredPage() {
  const t = useTranslations();
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlanCatalogEntry[]>([]);
  const [contact, setContact] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

  useEffect(() => {
    // Module SA-03: prices/limits/features now come from the Super-Admin-
    // managed catalog (/subscription_plans), not static i18n text — public
    // read, no auth required (see firestore.rules "Subscription plan
    // catalog" block).
    getSubscriptionPlansOnce()
      .then(setPlans)
      .catch(() => setPlans([]));

    // Module SA-05: contact info now Super-Admin-managed (/platform_settings/
    // general) instead of the previous hardcoded CONTACT_PHONE/CONTACT_EMAIL
    // constants — public read, no auth required.
    getPlatformSettingsOnce()
      .then(setContact)
      .catch(() => {
        /* keep the default already shown */
      });
  }, []);

  const whatsappHref = `https://wa.me/${contact.whatsappPhone.replace(/^0/, "880")}`;

  async function handleLogout() {
    await signOut();
    // FIX (bugfixed session): this app has no `/bn`/`/en` URL prefix — the
    // old `/${locale}/login` redirect always pointed at the non-existent
    // `/bn/login` route (404). The real login route is just `/login`.
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <BrandLogoLockup logoUrl={contact.logoUrl} size={40} tone="dark" className="mb-6" />
          <h1 className="text-2xl font-semibold text-neutral-900">{t("trial.expiredTitle")}</h1>
          <p className="mt-2 max-w-md text-sm text-neutral-500">{t("trial.expiredSubtitle")}</p>
          <div className="mt-3 flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("trial.dataSecure")}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <PackageCard key={plan.id} plan={plan} highlighted={plan.id === "standard"} />
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">{t("trial.contactTitle")}</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 text-sm font-medium text-white"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {t("trial.whatsappContact")}
            </a>
            <a
              href={`tel:${contact.supportPhone}`}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-brand-primary text-sm font-medium text-brand-primary"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {t("trial.phoneContact")}: {contact.supportPhone}
            </a>
            <a
              href={`mailto:${contact.supportEmail}`}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-600"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t("trial.emailContact")}
            </a>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 items-center gap-2 rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t("trial.logoutBtn")}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-400">
          <Link href="/about" className="hover:text-brand-primary hover:underline">
            {t("auth.aboutUsLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
