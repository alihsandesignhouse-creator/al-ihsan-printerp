"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, MessageCircle, Mail, CheckCircle2, XCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  fetchNotificationGatewayStatus,
  sendTestNotification,
  type NotificationGatewayStatus,
} from "@/lib/firebase/super-admin-notifications";

/**
 * components/super-admin/settings/notification-gateway-panel.tsx — SA-05,
 * "নোটিফিকেশন গেটওয়ে" tab.
 *
 * Status-only + test-send, deliberately NOT an edit form: SSL Wireless /
 * Resend credentials live in Netlify Environment Variables (server-only
 * secrets, see lib/server/sms-gateway.ts and lib/server/email-gateway.ts's
 * header comments) rather than Firestore, so there is nothing here for a
 * Super Admin to type in and save — only whether the platform-level
 * connection is configured, and a way to prove it actually works.
 */
type Channel = "sms" | "email" | "whatsapp";

export function NotificationGatewayPanel() {
  const t = useTranslations("sa.settingsPage.gateway");

  const [status, setStatus] = useState<NotificationGatewayStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [testChannel, setTestChannel] = useState<Channel | null>(null);
  const [recipient, setRecipient] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchNotificationGatewayStatus()
      .then((s) => setStatus(s))
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  function openTestDialog(channel: Channel) {
    setTestChannel(channel);
    setRecipient("");
  }

  async function handleSendTest() {
    if (!testChannel || !recipient.trim()) return;
    setIsSending(true);
    try {
      const result = await sendTestNotification(testChannel, recipient.trim());
      if (result.ok) {
        toast.success(t("testSent"));
        setTestChannel(null);
      } else {
        toast.error(result.error ?? t("testFailed"));
      }
    } catch {
      toast.error(t("testFailed"));
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (loadFailed || !status) {
    return <p className="text-sm text-status-danger">{t("loadFailed")}</p>;
  }

  const rows: Array<{
    channel: Channel;
    icon: typeof MessageSquare;
    label: string;
    providerLabel: string;
    configured: boolean;
  }> = [
    {
      channel: "sms",
      icon: MessageSquare,
      label: t("sms"),
      providerLabel: t("smsProvider"),
      configured: status.smsConfigured,
    },
    {
      channel: "email",
      icon: Mail,
      label: t("email"),
      providerLabel: t("emailProvider"),
      configured: status.emailConfigured,
    },
    {
      channel: "whatsapp",
      icon: MessageCircle,
      label: t("whatsapp"),
      providerLabel: t("whatsappProvider"),
      configured: status.whatsappConfigured,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">{t("description")}</p>

      <div className="space-y-3">
        {rows.map(({ channel, icon: Icon, label, providerLabel, configured }) => (
          <div
            key={channel}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-50 text-neutral-500">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{label}</p>
                <p className="text-xs text-neutral-500">{providerLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  configured ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {configured ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <XCircle className="h-3 w-3" aria-hidden="true" />
                )}
                {configured ? t("configured") : t("notConfigured")}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={!configured}
                onClick={() => openTestDialog(channel)}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {t("sendTest")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={testChannel !== null} onOpenChange={(open) => !open && setTestChannel(null)}>
        <DialogContent>
          {testChannel && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {testChannel === "sms"
                    ? t("testSmsTitle")
                    : testChannel === "whatsapp"
                      ? t("testWhatsappTitle")
                      : t("testEmailTitle")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-neutral-700">
                  {testChannel === "sms"
                    ? t("testRecipientPhone")
                    : testChannel === "whatsapp"
                      ? t("testRecipientWhatsapp")
                      : t("testRecipientEmail")}
                </Label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={testChannel === "email" ? "name@example.com" : "01XXXXXXXXX"}
                  type={testChannel === "email" ? "email" : "tel"}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setTestChannel(null)} disabled={isSending}>
                  {t("cancel")}
                </Button>
                <Button type="button" onClick={handleSendTest} disabled={isSending || !recipient.trim()}>
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  {isSending ? t("sending") : t("sendTest")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
