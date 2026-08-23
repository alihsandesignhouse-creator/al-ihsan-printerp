/**
 * Shared, locale-aware date/time/currency formatters.
 *
 * Audit finding (C3): ~9 components each defined their own local `formatDate`
 * / `formatDateTime` function, every one hardcoded to the `"bn-BD"` Intl
 * locale — meaning the ভাষা টগল (blueprint section ১৫) silently did nothing
 * to dates/times shown in tables, print views, and detail pages, even though
 * section ১৫.৩ explicitly promises dates switch with the language toggle
 * (`২৮ জুন ২০২৬` ⇄ `Jun 28, 2026`).
 *
 * These helpers centralize that logic in one place and take the current
 * locale (from next-intl's `useLocale()`) as an explicit parameter, so every
 * call site stays in sync with the toggle instead of re-implementing its own
 * (buggy) copy.
 *
 * Note: Super Admin pages intentionally keep hardcoded `"bn-BD"` formatting —
 * that panel has no language toggle at all (see components/shared/
 * language-toggle.tsx usage — it only appears in the tenant-facing navbar),
 * so there is no locale to switch to there.
 */

export type AppLocale = "bn" | "en";

/** Maps the app's next-intl locale code to the matching Intl/BCP-47 locale. */
export function toIntlLocale(locale: string): "bn-BD" | "en-US" {
  return locale === "bn" ? "bn-BD" : "en-US";
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** Locale-aware date formatting — replaces per-component `formatDate()` copies. */
export function formatDateLocalized(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string {
  return date.toLocaleDateString(toIntlLocale(locale), options);
}

/** Locale-aware date+time formatting — replaces per-component `formatDateTime()` copies. */
export function formatDateTimeLocalized(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATETIME_OPTIONS
): string {
  return date.toLocaleString(toIntlLocale(locale), options);
}

/** Locale-aware time-only formatting (e.g. notification/portal "last checked" labels). */
export function formatTimeLocalized(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
): string {
  return date.toLocaleTimeString(toIntlLocale(locale), options);
}

/**
 * Locale-aware Taka formatting. `lib/utils/calculations.ts`'s `formatTaka()`
 * remains the canonical, locale-independent formatter used across dozens of
 * existing call sites (always `৳` + Western digits) — this variant is for
 * the handful of components that need the currency label itself to switch
 * with the language toggle (blueprint ১৫.৩: `৳১,২৩৪` ⇄ `BDT 1,234`).
 */
export function formatTakaLocalized(amount: number, locale: string): string {
  const sign = amount < 0 ? "-" : "";
  const intlLocale = toIntlLocale(locale);
  const abs = Math.abs(amount).toLocaleString(intlLocale, { maximumFractionDigits: 2 });
  return locale === "bn" ? `${sign}৳${abs}` : `${sign}BDT ${abs}`;
}
