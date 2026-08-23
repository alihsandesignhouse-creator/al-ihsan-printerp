"use client";

import { useState } from "react";
import { getIdToken } from "firebase/auth";
import { useTranslations } from "next-intl";
import { MessageCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatTaka } from "@/lib/utils/calculations";

interface WhatsAppSendButtonProps {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  dueAmount: number;
}

/**
 * components/tenant/orders/whatsapp-send-button.tsx
 *
 * Phase 4 ("WhatsApp ইন্টিগ্রেশন | চালান ও বকেয়া WhatsApp-এ") — manual
 * send only, order-detail page (T-02). See
 * app/api/notifications/send-whatsapp/route.ts and
 * lib/server/whatsapp-gateway.ts for the server side and the CRITICAL
 * note about needing a Meta-approved message template before this can
 * actually deliver anything.
 *
 * The preview below is NOT an editable textarea — unlike a plain SMS/Email
 * draft, a WhatsApp Business Template message's wording is fixed (approved
 * by Meta ahead of time); only the {{1}}/{{2}}/{{3}} values shown here
 * change per-send. Editing the surrounding text here would misrepresent
 * what actually gets sent, so this dialog only shows an honest preview
 * and a confirm button.
 */
export function WhatsAppSendButton({
  tenantId,
  orderId,
  orderNumber,
  customerName,
  customerPhone,
  dueAmount,
}: WhatsAppSendButtonProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const contextLine =
    dueAmount > 0
      ? `${t("orders.orderNumber")} #${orderNumber} (${t("orders.dueAmount")}: ${formatTaka(dueAmount)})`
      : `${t("orders.orderNumber")} #${orderNumber}`;

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/portal/${tenantId}?order=${encodeURIComponent(orderNumber)}`
      : "";

  async function handleSend() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error(t("orders.whatsappSendFailed"));
      return;
    }
    setIsSending(true);
    try {
      const token = await getIdToken(currentUser);
      // SEC-001 fix (১৬ আগস্ট ২০২৬): branchId/phone/customerName আর body-তে
      // পাঠানো হয় না — সার্ভার এখন orderId থেকে আসল recipient/branch/নাম
      // নিজেই লোড করে (দেখুন app/api/notifications/send-whatsapp/route.ts)।
      const res = await fetch("/api/notifications/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, contextLine, link }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error || t("orders.whatsappSendFailed"));
        return;
      }
      toast.success(t("orders.whatsappSent"));
      setOpen(false);
    } catch {
      toast.error(t("orders.whatsappSendFailed"));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!customerPhone}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {t("orders.sendWhatsApp")}
      </button>

      <Dialog open={open} onOpenChange={(next) => !isSending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orders.whatsappPreviewTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-xs text-neutral-500">{t("orders.whatsappPreviewNote")}</p>
            <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
              <p>
                {customerName}, {t("orders.whatsappPreviewBody", { context: contextLine })}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-brand-primary">{link}</p>
            </div>
            <p className="text-xs text-neutral-400">
              {t("orders.whatsappRecipient")}: {customerPhone}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSending}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {isSending ? t("common.loading") : t("orders.sendWhatsApp")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
