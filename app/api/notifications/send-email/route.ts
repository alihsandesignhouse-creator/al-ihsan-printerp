import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { computeEffectiveFeatures, DEFAULT_NOTIFICATION_TEMPLATES, type PlanId } from "@/lib/server/plan-features";
import { renderNotificationTemplate } from "@/lib/server/render-notification-template";
import { getEmailTemplate, EVENT_EMAIL_SUBJECTS } from "@/lib/server/notification-events";
import { sendEmailViaResend } from "@/lib/server/email-gateway";
import { verifyOrderAndLoadRecipient } from "@/lib/server/verify-order-recipient";
import { MAX_NOTIFICATION_ATTEMPTS, NOTIFICATION_RETRY_DELAY_MINUTES } from "@/lib/types/notification-delivery";

/**
 * POST /api/notifications/send-email
 *
 * Free Edition Phase F3: replaces the Cloud Function `sendEmail` (blueprint
 * Phase 3, module #29). Mirrors send-sms/route.ts exactly — same
 * Direct-Call Pattern, premium gating (`emailNotifications`), idempotent
 * docId, retry-queue-on-failure shape, and SEC-001 order/recipient
 * ownership verification (১৬ আগস্ট ২০২৬ external audit — see that file's
 * header comment for the shared design rationale; `branchId` and the
 * recipient `email` are always derived server-side from the verified
 * order/customer, never trusted from the request body).
 *
 * The rendered template text is wrapped in a minimal HTML shell (Resend
 * requires `html`, and the templates themselves are plain text with
 * `{{placeholder}}` tokens — blueprint T-09 UI edits them as plain text).
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  event: z.enum(["orderConfirmation", "paymentReceived", "deliveryReminder", "dueReminder"]),
  orderId: z.string().min(1),
  params: z.record(z.string()),
});

function wrapHtml(pressName: string, bodyText: string): string {
  const escaped = bodyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111827">
    <p>${escaped.replace(/\n/g, "<br/>")}</p>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:16px 0" />
    <p style="color:#6B7280;font-size:12px">${pressName}</p>
  </div>`;
}

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

    if (!effectiveFeatures.emailNotifications) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // ── 3b. Verify the order belongs to this tenant, derive the real
    //        recipient/branch server-side (SEC-001 fix) ───────────────────
    const orderInfo = await verifyOrderAndLoadRecipient(tenantId, body.orderId);
    if (!orderInfo) {
      return NextResponse.json({ error: "অর্ডার পাওয়া যায়নি" }, { status: 404 });
    }
    if (!orderInfo.customerEmail) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const email = orderInfo.customerEmail;
    const branchId = orderInfo.branchId;

    const pressName = (tenant.name as string) ?? "";
    const templates = tenant.notificationTemplates ?? DEFAULT_NOTIFICATION_TEMPLATES;
    const template = getEmailTemplate(templates, body.event);
    const bodyText = renderNotificationTemplate(template, {
      ...body.params,
      pressName,
      customerName: orderInfo.customerName,
    });
    const subject = `${EVENT_EMAIL_SUBJECTS[body.event]} — ${pressName}`;
    const html = wrapHtml(pressName, bodyText);

    // ── 4. Create/overwrite the delivery record (idempotent) ─────────────
    const docId = `email_${body.event}_${body.orderId}`;
    const deliveryRef = db.collection("tenants").doc(tenantId).collection("notification_deliveries").doc(docId);

    const result = await sendEmailViaResend(email, subject, html);

    if (result.ok) {
      await deliveryRef.set({
        id: deliveryRef.id,
        tenantId,
        branchId,
        channel: "email",
        event: body.event,
        recipient: email,
        content: html,
        subject,
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

    const nextRetryAt = Timestamp.fromMillis(Date.now() + NOTIFICATION_RETRY_DELAY_MINUTES * 60_000);
    await deliveryRef.set({
      id: deliveryRef.id,
      tenantId,
      branchId,
      channel: "email",
      event: body.event,
      recipient: email,
      content: html,
      subject,
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
      console.error("[api/notifications/send-email]", err);
    }
    return NextResponse.json({ error: "Email পাঠানো যায়নি" }, { status: 500 });
  }
}
