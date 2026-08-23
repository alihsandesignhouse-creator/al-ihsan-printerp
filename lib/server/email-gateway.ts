/**
 * lib/server/email-gateway.ts
 *
 * Resend REST API client — Free Edition replacement for the `sendEmail`
 * Cloud Function (blueprint Phase 3, module #29).
 *
 * Server-only — called from app/api/notifications/send-email/route.ts and
 * the retry Scheduled Function.
 *
 * ── Credentials (Netlify Environment Variables, never committed) ─────────
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL   (must be a verified sender/domain in the Resend
 *                        dashboard — e.g. "AL-IHSAN PrintERP <notify@yourdomain.com>")
 */

export interface EmailSendResult {
  ok: boolean;
  error?: string;
}

interface ResendErrorResponse {
  message?: string;
}

export async function sendEmailViaResend(to: string, subject: string, html: string): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromAddress) {
    return { ok: false, error: "RESEND_API_KEY/RESEND_FROM_EMAIL কনফিগার করা নেই" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: fromAddress, to, subject, html }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as ResendErrorResponse | null;
      return { ok: false, error: data?.message || `Resend HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
