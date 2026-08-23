import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export type SupportedLocale = "bn" | "en";

export default getRequestConfig(async () => {
  // Locale preference is stored in a cookie when the user toggles language
  // (blueprint section 15.1). Defaults to Bengali.
  const cookieStore = cookies();
  const localeCookie = cookieStore.get("lang")?.value;
  const locale: SupportedLocale = localeCookie === "en" ? "en" : "bn";

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // Fixes next-intl's ENVIRONMENT_FALLBACK warning (SSR/client hydration
    // mismatch risk for any relative-time/date formatting). App's scheduled
    // functions already assume Asia/Dhaka, so it's the correct fixed value.
    timeZone: "Asia/Dhaka",
  };
});
