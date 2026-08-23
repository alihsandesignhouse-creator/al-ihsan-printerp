import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { computeEffectiveFeatures, type PlanId } from "@/lib/server/plan-features";
import { sendWhatsAppTemplateMessage } from "@/lib/server/whatsapp-gateway";
import { verifyOrderAndLoadRecipient } from "@/lib/server/verify-order-recipient";
import { BD_PHONE_REGEX } from "@/lib/validations/auth";

/**
 * POST /api/notifications/send-whatsapp
 *
 * Free Edition Phase 4 ("WhatsApp ইন্টিগ্রেশন | চালান ও বকেয়া WhatsApp-এ").
 * Manual-trigger only (per scoping decision — unlike SMS/Email, this is
 * NOT auto-fired on order/payment events; a staff member clicks a button
 * on the order-detail page, see components/tenant/orders/whatsapp-send-button.tsx).
 *
 * Security model: same as send-sms/send-email — Bearer ID-token verified
 * server-side, tenantId from the verified custom claim. Any active tenant
 * user (not just tenant_admin) may trigger this, matching who can already
 * see the order-detail page and its Phone/Print action buttons.
 *
 * SEC-001 fix (১৬ আগস্ট ২০২৬ external audit, same class of issue as
 * send-sms/send-email): `orderId` must reference a real order in this
 * tenant, and `branchId`/`phone`/`customerName` are always derived
 * server-side from that order and its customer record — never trusted
 * from the request body. Previously any active staff member could send a
 * WhatsApp template message (a real, billed Meta Business API call) to an
 * arbitrary phone number with an arbitrary customer name and link.
 *
 * Premium gating: whatsappNotifications in the tenant's *effective* plan
 * features (blueprint 4.3 tier: same as SMS/Email — Premium only).
 *
 * Unlike send-sms/send-email, a failed send is NOT queued for automatic
 * retry (no `nextRetryAt`, status goes straight to "failed") — this is a
 * manual, staff-initiated action, so the staff member sees the failure
 * immediately (toast) and can just press the button again; a silent
 * background retry for something they're watching happen live would be
 * surprising, not helpful. netlify/functions/retry-notification-deliveries.mts
 * is intentionally NOT touched by this feature.
 *
 * Idempotency: NOT deterministic (unlike send-sms's `sms_{event}_{orderId}`)
 * — a staff member may legitimately send the same order's WhatsApp update
 * more than once (e.g. resending after the customer says they didn't get
 * it), and each such send should show up as its own history entry.
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  orderId: z.string().min(1),
  /** Human-readable context line, e.g. "অর্ডার #PP-2026-0001" — built client-side, see whatsapp-send-button.tsx. */
  contextLine: z.string().min(1).max(200),
  /** Full portal tracking link, e.g. https://.../portal/{tenantId}?order=... — built client-side (needs window.location.origin, same as components/shared/tracking-qr-code.tsx). */
  link: z.string().url(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "লগইন প্রয়োজন" }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  let tenantId: string;
  let uid: string;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const claimedTenantId = decoded.tenantId as string | undefined;
    if (!claimedTenantId || decoded.isActive !== true) {
      return NextResponse.json({ error: "অ্যাক্সেস নেই" }, { status: 403 });
    }
    tenantId = claimedTenantId;
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "লগইন প্রয়োজন" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "অনুরোধ অবৈধ" }, { status: 400 });
  }

  try {
    const db = getAdminDb();

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) {
      return NextResponse.json({ error: "টেন্যান্ট পাওয়া যায়নি" }, { status: 404 });
    }
    const tenant = tenantSnap.data()!;
    const planId = tenant.planId as PlanId;
    const featureOverrides = (tenant.featureOverrides ?? {}) as Record<string, boolean>;
    const effectiveFeatures = computeEffectiveFeatures(planId, featureOverrides);

    if (!effectiveFeatures.whatsappNotifications) {
      return NextResponse.json(
        { error: "WhatsApp নোটিফিকেশন এই প্যাকেজে অন্তর্ভুক্ত নয় (Premium প্রয়োজন)" },
        { status: 403 }
      );
    }

    // SEC-001 fix: verify the order belongs to this tenant, derive the
    // real recipient/branch/customer-name server-side.
    const orderInfo = await verifyOrderAndLoadRecipient(tenantId, body.orderId);
    if (!orderInfo) {
      return NextResponse.json({ error: "অর্ডার পাওয়া যায়নি" }, { status: 404 });
    }
    if (!orderInfo.customerPhone) {
      return NextResponse.json({ error: "এই অর্ডারের কাস্টমারের কোনো ফোন নম্বর নেই" }, { status: 400 });
    }
    if (!BD_PHONE_REGEX.test(orderInfo.customerPhone)) {
      return NextResponse.json({ error: "ফোন নম্বর সঠিক নয় (01XXXXXXXXX)" }, { status: 400 });
    }
    const phone = orderInfo.customerPhone;
    const customerName = orderInfo.customerName || "কাস্টমার";
    const branchId = orderInfo.branchId;

    const deliveryRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("notification_deliveries")
      .doc();

    const result = await sendWhatsAppTemplateMessage(phone, [customerName, body.contextLine, body.link]);

    // Human-readable content mirrors the approved template's body shape
    // (see whatsapp-gateway.ts) — for the delivery-history view, not what
    // literally gets sent (that's Meta's fixed template text).
    const content = `${customerName}, আপনার ${body.contextLine} সংক্রান্ত একটি তথ্য আছে। বিস্তারিত দেখুন: ${body.link}`;

    await deliveryRef.set({
      id: deliveryRef.id,
      tenantId,
      branchId,
      channel: "whatsapp",
      event: "manualWhatsapp",
      recipient: phone,
      content,
      subject: null,
      relatedOrderId: body.orderId,
      status: result.ok ? "sent" : "failed",
      attempts: 1,
      lastError: result.ok ? null : (result.error ?? "unknown error"),
      nextRetryAt: null,
      sentBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "WhatsApp পাঠানো যায়নি" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/notifications/send-whatsapp]", err);
    }
    return NextResponse.json({ error: "WhatsApp পাঠানো যায়নি" }, { status: 500 });
  }
}
