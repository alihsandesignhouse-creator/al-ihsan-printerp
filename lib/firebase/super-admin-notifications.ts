import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * lib/firebase/super-admin-notifications.ts — SA-05, "নোটিফিকেশন গেটওয়ে"
 * tab. Thin client wrappers around the two Admin-SDK-backed API routes
 * (env-var secrets can't be read or exercised from the client bundle) —
 * same Bearer-ID-token call shape as `fireActivateTenantClaims` in
 * lib/firebase/tenants.ts.
 */

export interface NotificationGatewayStatus {
  smsConfigured: boolean;
  emailConfigured: boolean;
  whatsappConfigured: boolean;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("লগইন প্রয়োজন");
  const token = await getIdToken(currentUser);
  return { Authorization: `Bearer ${token}` };
}

export async function fetchNotificationGatewayStatus(): Promise<NotificationGatewayStatus> {
  const headers = await getAuthHeader();
  const res = await fetch("/api/super-admin/notification-status", { headers });
  if (!res.ok) throw new Error("স্ট্যাটাস আনতে ব্যর্থ হয়েছে");
  return (await res.json()) as NotificationGatewayStatus;
}

export interface SendTestNotificationResult {
  ok: boolean;
  error?: string;
}

export async function sendTestNotification(
  channel: "sms" | "email" | "whatsapp",
  recipient: string
): Promise<SendTestNotificationResult> {
  const headers = await getAuthHeader();
  const res = await fetch("/api/super-admin/test-notification", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ channel, recipient }),
  });
  const data = (await res.json().catch(() => null)) as SendTestNotificationResult | null;
  if (!res.ok) {
    return { ok: false, error: data?.error ?? "অনুরোধ ব্যর্থ হয়েছে" };
  }
  return data ?? { ok: false, error: "অপ্রত্যাশিত রেসপন্স" };
}
