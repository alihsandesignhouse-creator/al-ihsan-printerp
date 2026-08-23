"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";

type Locale = "bn" | "en";

interface LanguageToggleProps {
  currentLocale: Locale;
}

/**
 * [বাং | EN] toggle, always visible in navbar per blueprint section 15.1.
 *
 * FIX (bugfixed session): this app does NOT use next-intl's URL-prefix
 * ([locale] segment) routing — `lib/i18n/request.ts` resolves the active
 * locale purely from the `lang` cookie on the server. The previous
 * implementation assumed a `/bn/...` `/en/...` URL structure that doesn't
 * exist in this app (`pathname.split("/")` + `segments[1] = locale`),
 * which sent users to non-existent routes like `/en` or `/en/profile`
 * (confirmed 404s in dev logs) and never actually changed the rendered
 * language, since the `lang` cookie the server reads was never written.
 *
 * Correct fix: write the `lang` cookie the server actually reads, then
 * `router.refresh()` to re-render server components with the new locale
 * on the *same* URL (no navigation needed).
 */
export function LanguageToggle({ currentLocale }: LanguageToggleProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isSwitching, setIsSwitching] = useState(false);

  async function switchLocale(locale: Locale) {
    if (locale === currentLocale || isSwitching) return;
    setIsSwitching(true);

    // 1 year, readable on all paths — this is the single source of truth
    // `lib/i18n/request.ts` reads on the server for every request.
    document.cookie = `lang=${locale}; path=/; max-age=31536000; SameSite=Lax`;

    try {
      // Kept for other consumers (e.g. printed documents, offline recall)
      // but is NOT what drives the active UI language.
      window.localStorage.setItem("printerp_locale", locale);

      const tenantId = user?.claims.tenantId;
      if (tenantId) {
        await setDoc(
          doc(db, "tenants", tenantId),
          { settings: { language: locale } },
          { merge: true }
        );
      }
    } catch {
      // Offline or permission issue — cookie already updated, safe to continue.
    }

    router.refresh();
    setIsSwitching(false);
  }

  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200 text-xs font-medium">
      <button
        type="button"
        onClick={() => switchLocale("bn")}
        aria-pressed={currentLocale === "bn"}
        className={`px-2.5 py-1.5 transition-colors ${
          currentLocale === "bn"
            ? "bg-brand-primary text-white"
            : "bg-white text-neutral-500 hover:bg-neutral-50"
        }`}
      >
        বাং
      </button>
      <button
        type="button"
        onClick={() => switchLocale("en")}
        aria-pressed={currentLocale === "en"}
        className={`px-2.5 py-1.5 transition-colors ${
          currentLocale === "en"
            ? "bg-brand-primary text-white"
            : "bg-white text-neutral-500 hover:bg-neutral-50"
        }`}
      >
        EN
      </button>
    </div>
  );
}
