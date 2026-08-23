/**
 * lib/server/whatsapp-gateway.ts
 *
 * Meta WhatsApp Cloud API client — Free Edition Phase 4 ("WhatsApp
 * ইন্টিগ্রেশন | চালান ও বকেয়া WhatsApp-এ"). Server-only (never imported by
 * client bundles) — called from app/api/notifications/send-whatsapp/route.ts
 * and app/api/super-admin/test-notification/route.ts.
 *
 * ── Credentials (Netlify Environment Variables, never committed/Firestore,
 *    same convention as lib/server/sms-gateway.ts / email-gateway.ts) ────
 *   WHATSAPP_ACCESS_TOKEN      Meta Business → System User permanent token
 *                              (or a long-lived token) with
 *                              `whatsapp_business_messaging` permission
 *   WHATSAPP_PHONE_NUMBER_ID   Meta Business → WhatsApp → API Setup →
 *                              "Phone number ID" (NOT the phone number
 *                              itself)
 *   WHATSAPP_TEMPLATE_NAME     The exact name of your Meta-APPROVED message
 *                              template (see below — REQUIRED, this
 *                              integration cannot send free-form text)
 *   WHATSAPP_TEMPLATE_LANG     Template's approved language code, e.g.
 *                              "bn" or "en_US" (optional, defaults to "bn")
 *
 * ── ⚠️ CRITICAL: this cannot send arbitrary text — Meta requires a
 *    pre-approved Message Template for any business-initiated message
 *    (i.e. one the customer didn't message first, which is this whole
 *    feature's use case) ─────────────────────────────────────────────────
 * Unlike SMS/Email, WhatsApp Business accounts may NOT send free-form text
 * to a customer unless that customer messaged the business within the last
 * 24 hours. Since this feature is staff-initiated ("চালান ও বকেয়া
 * WhatsApp-এ পাঠান" button), every send falls outside that window and MUST
 * use an approved Message Template — Meta rejects anything else with an
 * API error (this is a WhatsApp platform policy, not something this code
 * can work around).
 *
 * **Before this feature will actually send anything**, create and submit
 * a template for approval in Meta Business Manager → WhatsApp Manager →
 * Message Templates, matching this exact structure (this codebase sends
 * exactly 3 positional body parameters — the approved template's body must
 * have exactly {{1}}, {{2}}, {{3}} in that order, category UTILITY is the
 * correct choice for order/account updates, NOT MARKETING):
 *
 *   নাম:      al_ihsan_order_update  (বা যেকোনো নাম — WHATSAPP_TEMPLATE_NAME-এ বসান)
 *   ক্যাটাগরি: UTILITY
 *   ভাষা:      bn (বাংলা)
 *   বডি:       "{{1}}, আপনার {{2}} সংক্রান্ত একটি তথ্য আছে। বিস্তারিত
 *              দেখুন: {{3}}"
 *
 *   {{1}} = গ্রাহকের নাম, {{2}} = কনটেক্সট (যেমন "অর্ডার #PP-2026-0001"),
 *   {{3}} = গ্রাহক-পোর্টাল লিংক
 *
 * Approval typically takes minutes to ~1 day. Until approved, every send
 * from this integration will fail with a clear error surfaced to the
 * staff member (see the API route) — nothing fails silently.
 *
 * ── API contract note ─────────────────────────────────────────────────
 * Uses Graph API v20.0 `POST /{phone-number-id}/messages`. This sandbox
 * has no network access to test the live API — the request shape below
 * matches Meta's current published documentation, but should be verified
 * against a real WhatsApp Business test number before production use
 * (same caveat as sms-gateway.ts's SSL Wireless response-shape note).
 */

export interface WhatsAppSendResult {
  ok: boolean;
  error?: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `880${digits}`;
}

interface WhatsAppErrorBody {
  error?: { message?: string; error_user_msg?: string };
}

/**
 * Sends the platform's one configured WhatsApp message template with 3
 * positional body parameters, in order. See the file header for exactly
 * what template must be approved in Meta Business Manager for this to
 * succeed.
 */
export async function sendWhatsAppTemplateMessage(
  phone: string,
  bodyParams: [customerName: string, contextLine: string, link: string]
): Promise<WhatsAppSendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "bn";

  if (!accessToken || !phoneNumberId || !templateName) {
    return {
      ok: false,
      error:
        "WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_TEMPLATE_NAME কনফিগার করা নেই",
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(phone),
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            {
              type: "body",
              parameters: bodyParams.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    if (res.ok) return { ok: true };

    const data = (await res.json().catch(() => null)) as WhatsAppErrorBody | null;
    const message =
      data?.error?.error_user_msg || data?.error?.message || `WhatsApp API HTTP ${res.status}`;
    return { ok: false, error: message };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "নেটওয়ার্ক এরর" };
  }
}
