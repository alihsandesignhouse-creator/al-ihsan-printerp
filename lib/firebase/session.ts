import type { AuthClaims } from "@/lib/types/auth";

/**
 * Single source of truth for the `printerp_session` cookie that
 * middleware.ts reads for a fast, UX-level route redirect (blueprint
 * section 11.3) — NOT a verified credential (see middleware.ts's docstring
 * for the full security model: real access control lives in firestore.rules
 * plus each authenticated layout's own useAuthListener()-based check).
 *
 * IMPORTANT: this must be called SYNCHRONOUSLY, immediately after a
 * successful login/signup, right before any router.push(). The
 * Next.js App Router runs middleware on client-side navigations too,
 * so if the cookie is only written later (e.g. from the async
 * onAuthStateChanged listener in components/layout/Providers.tsx) there
 * is a race: middleware can see "no session" and bounce the freshly
 * logged-in user back to /login. Writing it here removes that race;
 * Providers.tsx still re-writes it on every token refresh so the cookie
 * stays in sync with claim changes (e.g. trial expiry, suspension).
 */
const SESSION_COOKIE_NAME = "printerp_session";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // 24h (default, "মনে রাখুন" আনচেক করা থাকলে)
const REMEMBERED_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 দিন ("মনে রাখুন" চেক করা থাকলে)

/**
 * @param remember "মনে রাখুন" চেকবক্স চেক করা থাকলে true — কুকির মেয়াদ ২৪ঘ
 *   থেকে ৩০ দিনে বাড়ে, যাতে এই UX-কুকিটা (নিচের ডকস্ট্রিং দেখুন — এটা
 *   real credential না) নিজে থেকেই এক্সপায়ার হয়ে middleware ব্যবহারকারীকে
 *   /login-এ ফেরত না পাঠায়, যদিও lib/firebase/auth.ts-এর
 *   browserLocalPersistence-এর কারণে আসল Firebase Auth সেশন তখনো সচল
 *   থাকে। remember=false হলে আগের মতোই ২৪ ঘণ্টা।
 */
export function writeSessionCookie(claims: AuthClaims, remember: boolean = true): void {
  const payload = {
    role: claims.role,
    isActive: claims.isActive,
    isTrial: claims.isTrial,
    tenantId: claims.tenantId,
  };
  const encoded = btoa(JSON.stringify(payload));
  const maxAge = remember ? REMEMBERED_SESSION_COOKIE_MAX_AGE_SECONDS : SESSION_COOKIE_MAX_AGE_SECONDS;
  document.cookie = `${SESSION_COOKIE_NAME}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0`;
}
