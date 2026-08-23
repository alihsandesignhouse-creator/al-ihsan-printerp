import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sendSmsViaGateway } from "@/lib/server/sms-gateway";
import { sendEmailViaResend } from "@/lib/server/email-gateway";
import { sendWhatsAppTemplateMessage } from "@/lib/server/whatsapp-gateway";
import { BD_PHONE_REGEX } from "@/lib/validations/auth";

/**
 * POST /api/super-admin/test-notification
 *
 * SA-05 "নোটিফিকেশন গেটওয়ে" tab's "টেস্ট পাঠান" button. Calls the same
 * gateway clients tenant notifications use (lib/server/sms-gateway.ts /
 * lib/server/email-gateway.ts / lib/server/whatsapp-gateway.ts) directly
 * with a fixed diagnostic message — bypassing the tenant plan-feature
 * gate and templates entirely, since this checks the platform-level
 * gateway connection itself, not any one tenant's notification setup.
 * Nothing is written to Firestore (no notification_deliveries record, no
 * retry-on-failure queueing) — this is a one-shot connectivity check,
 * not a real business notification.
 *
 * WhatsApp is different from SMS/Email here: Meta does not allow a
 * distinct free-text "diagnostic" message — every send (test or real)
 * must use the one configured WHATSAPP_TEMPLATE_NAME (see
 * lib/server/whatsapp-gateway.ts). The test send below fills that same
 * template with placeholder values, so this test also implicitly
 * confirms the template itself is approved and reachable, not just the
 * access token/phone-number-id.
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  channel: z.enum(["sms", "email", "whatsapp"]),
  recipient: z.string().min(1),
});

const TEST_SMS_TEXT = "এটি AL-IHSAN PrintERP-এর একটি টেস্ট SMS। গেটওয়ে সঠিকভাবে কাজ করছে।";
const TEST_EMAIL_SUBJECT = "AL-IHSAN PrintERP — টেস্ট Email";
const TEST_EMAIL_HTML =
  '<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111827">' +
  "<p>এটি AL-IHSAN PrintERP-এর একটি টেস্ট Email। গেটওয়ে সঠিকভাবে কাজ করছে।</p>" +
  "</div>";

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (body.channel === "sms") {
    if (!BD_PHONE_REGEX.test(body.recipient)) {
      return NextResponse.json({ ok: false, error: "ফোন নম্বর সঠিক নয় (01XXXXXXXXX)" }, { status: 400 });
    }
    const result = await sendSmsViaGateway(body.recipient, TEST_SMS_TEXT);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "SMS পাঠানো যায়নি" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.channel === "whatsapp") {
    if (!BD_PHONE_REGEX.test(body.recipient)) {
      return NextResponse.json({ ok: false, error: "ফোন নম্বর সঠিক নয় (01XXXXXXXXX)" }, { status: 400 });
    }
    const result = await sendWhatsAppTemplateMessage(body.recipient, [
      "টেস্ট",
      "গেটওয়ে যাচাই (টেস্ট মেসেজ)",
      "https://example.com/test",
    ]);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "WhatsApp পাঠানো যায়নি" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  const emailSchema = z.string().email();
  if (!emailSchema.safeParse(body.recipient).success) {
    return NextResponse.json({ ok: false, error: "Email ঠিকানা সঠিক নয়" }, { status: 400 });
  }
  const result = await sendEmailViaResend(body.recipient, TEST_EMAIL_SUBJECT, TEST_EMAIL_HTML);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Email পাঠানো যায়নি" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
