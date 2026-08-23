import { type NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/server/request-ip";

/**
 * GET /api/auth/client-ip
 *
 * Returns the caller's public IP address as seen by the server, for the
 * "লগইন ইতিহাস (ডিভাইস ও IP)" requirement in T-08 (blueprint section 11.6:
 * audit logs must record device & IP on login/logout). The client itself
 * cannot know its own public IP from JS alone — this route reads the
 * standard proxy headers Netlify's edge network sets (`x-forwarded-for`/
 * `x-real-ip`) on every request reaching this Next.js app.
 */
export function GET(req: NextRequest): NextResponse {
  const ip = getClientIp(req);
  return NextResponse.json({ ip: ip === "unknown" ? "" : ip });
}
