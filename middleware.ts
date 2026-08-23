import { NextResponse, type NextRequest } from "next/server";

/**
 * Route guard middleware per blueprint section 11.3.
 *
 * IMPORTANT — security model (AUDIT-REPORT-3.md Issue #3): the
 * `printerp_session` cookie is written client-side (lib/firebase/session.ts,
 * via plain `document.cookie`, not httpOnly/signed) immediately after
 * login/token-refresh so this middleware can redirect on the very next
 * navigation without waiting on an async round-trip. That means this cookie
 * is NOT a verified credential — a forged cookie value can get an
 * unauthorized browser past this middleware into a route's shell.
 *
 * This is safe only because two independent layers sit underneath it:
 *   1. firestore.rules checks the real, server-verified Firebase custom
 *      claims on request.auth.token — never this cookie — so no Firestore
 *      data is reachable just by spoofing the cookie.
 *   2. Each authenticated layout (app/(tenant)/layout.tsx and
 *      app/(super-admin)/layout.tsx) independently re-verifies the live
 *      Firebase Auth token via useAuthListener()/useAuthStore before
 *      rendering anything, and redirects if the real claims don't match —
 *      so even the page shell isn't reachable with just a forged cookie.
 * Treat this middleware as a fast UX-level redirect only, never as the
 * source of truth for access control.
 *
 * Trial/subscription status itself lives on the Firestore tenant document,
 * not in the JWT, so the authoritative trial-expiry redirect additionally
 * happens client-side in app/(tenant)/layout.tsx via a live onSnapshot
 * listener.
 *
 * Locale (bn/en) is stored in a cookie and toggled client-side (blueprint
 * section 15.1) — routes are NOT locale-prefixed, so this middleware works
 * on plain pathnames.
 *
 * Cookie shape (set at login): printerp_session = base64 JSON of
 * { role, isActive, isTrial, tenantId }
 */

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/portal", "/about"];

interface SessionClaims {
  role: string;
  isActive: boolean;
  isTrial: boolean;
  tenantId: string | null;
}

function parseSessionCookie(value: string | undefined): SessionClaims | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64").toString("utf-8"));
    if (
      typeof decoded.role === "string" &&
      typeof decoded.isActive === "boolean" &&
      typeof decoded.isTrial === "boolean"
    ) {
      return decoded as SessionClaims;
    }
    return null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = parseSessionCookie(request.cookies.get("printerp_session")?.value);

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isTrialExpiredPath = pathname === "/trial-expired";
  const isSuspendedPath = pathname === "/suspended";

  // Public routes: always accessible, no session required.
  if (isPublicPath) {
    return NextResponse.next();
  }

  // No session at all -> force login.
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Inactive account: either an expired trial (-> /trial-expired, package
  // upsell) or a suspended subscription / deactivated staff member
  // (-> /suspended, contact-only). Both pages allow only the logout action.
  if (!session.isActive) {
    if (session.isTrial) {
      if (isTrialExpiredPath) return NextResponse.next();
      return NextResponse.redirect(new URL("/trial-expired", request.url));
    }
    if (isSuspendedPath) return NextResponse.next();
    return NextResponse.redirect(new URL("/suspended", request.url));
  }

  // super_admin: only allowed under /super-admin/*
  if (session.role === "super_admin") {
    if (pathname.startsWith("/super-admin")) return NextResponse.next();
    return NextResponse.redirect(new URL("/super-admin/dashboard", request.url));
  }

  // Tenant roles: block /super-admin/*
  if (pathname.startsWith("/super-admin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Staff roles: role-based UI inside the (tenant) route group is enforced
  // at the page/component level; middleware only needs to admit the request.

  // Trial-expired path is allowed to render; the live Firestore listener in
  // (tenant)/layout.tsx is the authoritative gate for actual expiry, but the
  // session cookie's isTrial flag lets us fast-redirect obviously expired
  // trials when the cookie was refreshed after checkTrialExpiry ran.
  if (isTrialExpiredPath) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|api/).*)"],
};
