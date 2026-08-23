import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { computeEffectiveFeatures, DEFAULT_NOTIFICATION_TEMPLATES, type PlanId } from "@/lib/server/plan-features";
import { renderNotificationTemplate } from "@/lib/server/render-notification-template";
import { getSmsTemplate } from "@/lib/server/notification-events";
import { sendSmsViaGateway } from "@/lib/server/sms-gateway";
import { verifyOrderAndLoadRecipient } from "@/lib/server/verify-order-recipient";
import { MAX_NOTIFICATION_ATTEMPTS, NOTIFICATION_RETRY_DELAY_MINUTES } from "@/lib/types/notification-delivery";

/**
 * POST /api/notifications/send-sms
 *
 * Free Edition Phase F3: replaces the Cloud Function `sendSMS` (blueprint
 * Phase 3, module #28). Direct-Call Pattern — called immediately after the
 * triggering Firestore write (order creation, payment recording) resolves,
 * same best-effort/non-blocking shape as
 * app/api/notifications/new-order/route.ts.
 *
 * Security model: Bearer ID-token verified server-side, tenantId taken
 * from the verified custom claim (never from the request body). The
 * `orderId` is required and must reference a real order in this tenant
 * (SEC-001 fix, ১৬ আগস্ট ২০২৬ external audit) — `branchId` and the SMS
 * recipient `phone` are then always derived server-side from that order's
 * (and its customer's) actual data, never trusted from the request body.
 * This closes an open-relay-style abuse vector where any logged-in staff
 * member could previously send an arbitrary custom message to an
 * arbitrary phone number using the tenant's paid SMS credits, gated only
 * by "must be an active user of some tenant" with no order/recipient
 * ownership check at all.
 *
 * Premium gating: reads the tenant document via Admin SDK and checks
 * `smsNotifications` in the *effective* plan features (plan defaults +
 * Super Admin overrides) — a tenant on Basic/Standard cannot trigger a
 * real SMS send even if this route is called (blueprint 4.3: SMS is
 * Premium-only). This is a silent no-op (`{ ok: true, skipped: true }`),
 * not an error — the caller doesn't need to know or care.
 *
 * Idempotency: uses a deterministic docId (`sms_{event}_{orderId}`) so a
 * client retry after a flaky network response overwrites the same
 * delivery record instead of sending twice.
 *
 * Retry queue: on failure, writes status:"pending" + nextRetryAt (blueprint
 * ১৩.৩) so netlify/functions/retry-notification-deliveries.mts can retry.
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  event: z.enum(["orderConfirmation", "paymentReceived", "deliveryReminder", "dueReminder"]),
  // SEC-001 fix: orderId is now required (was `.nullable()`) — every
  // currently-defined event is order-linked (see header comment), and a
  // required orderId is what makes the ownership check below possible.
  orderId: z.string().min(1),
  params: z.record(z.string()),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Verify caller identity ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "লগইন প্রয়োজন" }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  let tenantId: string;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const claimedTenantId = decoded.tenantId as string | undefined;
    if (!claimedTenantId || decoded.isActive !== true) {
      return NextResponse.json({ error: "অ্যাক্সেস নেই" }, { status: 403 });
    }
    tenantId = claimedTenantId;
  } catch {
    return NextResponse.json({ error: "লগইন প্রয়োজন" }, { status: 401 });
  }

  // ── 2. Validate request body ───────────────────────────────────────────
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "অনুরোধ অবৈধ" }, { status: 400 });
  }

  try {
    const db = getAdminDb();

    // ── 3. Load tenant → plan features + template + pressName ────────────
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) {
      return NextResponse.json({ error: "টেন্যান্ট পাওয়া যায়নি" }, { status: 404 });
    }
    const tenant = tenantSnap.data()!;
    const planId = tenant.planId as PlanId;
    const featureOverrides = (tenant.featureOverrides ?? {}) as Record<string, boolean>;
    const effectiveFeatures = computeEffectiveFeatures(planId, featureOverrides);

    if (!effectiveFeatures.smsNotifications) {
      // Not an error — silently skip for non-Premium tenants (best-effort caller).
      return NextResponse.json({ ok: true, skipped: true });
    }

    // ── 3b. Verify the order belongs to this tenant, derive the real
    //        recipient/branch server-side (SEC-001 fix) ───────────────────
    const orderInfo = await verifyOrderAndLoadRecipient(tenantId, body.orderId);
    if (!orderInfo) {
      return NextResponse.json({ error: "অর্ডার পাওয়া যায়নি" }, { status: 404 });
    }
    if (!orderInfo.customerPhone) {
      // No phone on file for this order's customer — nothing to send to.
      // Silent no-op, same shape as the premium-gating skip above.
      return NextResponse.json({ ok: true, skipped: true });
    }
    const phone = orderInfo.customerPhone;
    const branchId = orderInfo.branchId;

    const templates = tenant.notificationTemplates ?? DEFAULT_NOTIFICATION_TEMPLATES;
    const template = getSmsTemplate(templates, body.event);
    const message = renderNotificationTemplate(template, {
      ...body.params,
      pressName: (tenant.name as string) ?? "",
    });

    // ── 4. Create/overwrite the delivery record (idempotent) ─────────────
    const docId = `sms_${body.event}_${body.orderId}`;
    const deliveryRef = db.collection("tenants").doc(tenantId).collection("notification_deliveries").doc(docId);

    const result = await sendSmsViaGateway(phone, message);

    if (result.ok) {
      await deliveryRef.set({
        id: deliveryRef.id,
        tenantId,
        branchId,
        channel: "sms",
        event: body.event,
        recipient: phone,
        content: message,
        subject: null,
        relatedOrderId: body.orderId,
        status: "sent",
        attempts: 1,
        lastError: null,
        nextRetryAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, sent: true });
    }

    // Failed on first attempt — queue for retry (blueprint ১৩.৩).
    const nextRetryAt = Timestamp.fromMillis(Date.now() + NOTIFICATION_RETRY_DELAY_MINUTES * 60_000);
    await deliveryRef.set({
      id: deliveryRef.id,
      tenantId,
      branchId,
      channel: "sms",
      event: body.event,
      recipient: phone,
      content: message,
      subject: null,
      relatedOrderId: body.orderId,
      status: 1 >= MAX_NOTIFICATION_ATTEMPTS ? "failed" : "pending",
      attempts: 1,
      lastError: result.error ?? "unknown error",
      nextRetryAt: 1 >= MAX_NOTIFICATION_ATTEMPTS ? null : nextRetryAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, sent: false, queued: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/notifications/send-sms]", err);
    }
    return NextResponse.json({ error: "SMS পাঠানো যায়নি" }, { status: 500 });
  }
}
