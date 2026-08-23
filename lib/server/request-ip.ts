import type { NextRequest } from "next/server";

/**
 * lib/server/request-ip.ts
 *
 * Shared by app/api/auth/client-ip/route.ts (T-08 login-history IP
 * recording) and every rate-limited route below. Previously duplicated
 * inline in each route with a stray comment claiming "Vercel's edge
 * network" sets these headers (audit item #5, cosmetic — this app
 * deploys on Netlify; Netlify's edge also sets the same standard
 * `x-forwarded-for`/`x-real-ip` proxy headers, so the code itself was
 * always correct, only the comment was wrong).
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null;
  const realIp = req.headers.get("x-real-ip");
  return ip || realIp || "unknown";
}
