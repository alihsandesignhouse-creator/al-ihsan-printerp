import { type NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";

/**
 * GET /api/super-admin/notification-status
 *
 * SA-05 "নোটিফিকেশন গেটওয়ে" tab. Reports whether the SMS (SSL Wireless),
 * Email (Resend), and WhatsApp (Meta Cloud API) gateway credentials are
 * present in the server environment — see lib/server/sms-gateway.ts /
 * lib/server/email-gateway.ts / lib/server/whatsapp-gateway.ts for the
 * exact variable names.
 *
 * Deliberately server-only: unlike a typical settings tab, these are API
 * secrets (SSLWIRELESS_API_TOKEN, RESEND_API_KEY) that must never reach
 * the client bundle or be stored in Firestore (which would put a secret
 * inside a database every super_admin session can already read). This
 * route only ever returns booleans, never the values themselves — the
 * gateway itself stays configured exclusively via Netlify Environment
 * Variables (see DEPLOYMENT-CHECKLIST.md).
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 401 });
  }

  const smsConfigured = Boolean(process.env.SSLWIRELESS_API_TOKEN && process.env.SSLWIRELESS_SID);
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  const whatsappConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_TEMPLATE_NAME
  );

  return NextResponse.json({ smsConfigured, emailConfigured, whatsappConfigured });
}
