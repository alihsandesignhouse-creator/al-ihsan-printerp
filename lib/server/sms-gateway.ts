/**
 * lib/server/sms-gateway.ts
 *
 * SSL Wireless Push SMS REST API client — Free Edition replacement for the
 * `sendSMS` Cloud Function (blueprint Phase 3, module #28; Free Edition
 * blueprint Phase F3: "SMS/Email নোটিফিকেশন — Netlify Function দিয়ে SSL
 * Wireless/Resend API কল").
 *
 * Server-only (imports nothing from the browser bundle) — called from
 * app/api/notifications/send-sms/route.ts and the retry Scheduled Function.
 *
 * ── Credentials (Netlify Environment Variables, never committed) ─────────
 *   SSLWIRELESS_API_TOKEN
 *   SSLWIRELESS_SID
 *   SSLWIRELESS_DOMAIN   (optional, defaults to https://smsplus.sslwireless.com)
 *
 * ── API contract note ──────────────────────────────────────────────────
 * SSL Wireless's dynamic Push-SMS endpoint accepts a JSON POST with
 * `api_token`, `sid`, `msisdn`, `sms`, and a client-generated `csms_id`
 * (used for de-duplication on their end), and returns a JSON body whose
 * exact success-field name has varied across SSL Wireless API versions
 * (`status: "SUCCESS"` in some docs/SDKs, `status_code: 200` in others).
 * This client checks for either so it isn't tied to one exact version —
 * but the account's actual sandbox response should be verified against a
 * real SSL Wireless test account before production use, since this sandbox
 * has no network access to test the live API. If the field names differ,
 * only the `success` check below needs adjusting.
 */

export interface SmsSendResult {
  ok: boolean;
  error?: string;
}

function normalizeMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `880${digits}`;
}

interface SslWirelessResponse {
  status?: string;
  status_code?: number;
  error_message?: string;
  reference_no?: string;
}

export async function sendSmsViaGateway(phone: string, message: string): Promise<SmsSendResult> {
  const apiToken = process.env.SSLWIRELESS_API_TOKEN;
  const sid = process.env.SSLWIRELESS_SID;
  const domain = process.env.SSLWIRELESS_DOMAIN || "https://smsplus.sslwireless.com";

  if (!apiToken || !sid) {
    return { ok: false, error: "SSLWIRELESS_API_TOKEN/SSLWIRELESS_SID কনফিগার করা নেই" };
  }

  const csmsId = `printerp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const res = await fetch(`${domain}/api/v3/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_token: apiToken,
        sid,
        msisdn: normalizeMsisdn(phone),
        sms: message,
        csms_id: csmsId,
      }),
    });

    const data = (await res.json().catch(() => null)) as SslWirelessResponse | null;
    const success = res.ok && (data?.status === "SUCCESS" || data?.status_code === 200);

    if (!success) {
      return { ok: false, error: data?.error_message || `SSL Wireless HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
