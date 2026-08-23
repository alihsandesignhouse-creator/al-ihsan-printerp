import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  DEFAULT_PLAN_FEATURES,
  generateSlug,
  type PlanFeatures,
} from "@/lib/server/plan-features";

/**
 * POST /api/super-admin/create-tenant
 *
 * Free Edition: this is no longer a proxy to the Cloud Function
 * `onAdminCreateTenant` (Firebase Spark plan cannot deploy Cloud
 * Functions). The exact same business logic that lived in
 * `functions/src/tenantFunctions.ts::onAdminCreateTenant` now runs
 * directly here using the Firebase Admin SDK (`lib/firebase/admin.ts`):
 *
 *   1. Verify the caller's Firebase ID token (sent in the Authorization
 *      header, same as before) and require `role === 'super_admin'` —
 *      this check happens server-side against the Admin SDK's verified
 *      token, never trusting anything the client claims about itself
 *   2. Validate the request body (same zod rules as the Cloud Function)
 *   3. Create the Firebase Auth user for the new tenant admin
 *   4. Create the Firestore `tenants/{uid}` document with
 *      subscriptionStatus: 'active' and the chosen plan's features
 *   5. Write a `subscription_history` entry and a `tenant.created` audit
 *      log entry
 *   6. Set the `tenantId` / `role: 'tenant_admin'` / `isActive` custom
 *      claims that `firestore.rules` and `middleware.ts` both check
 *
 * No business rule was changed or dropped in this migration — only the
 * transport (direct Admin SDK call inside this Next.js route handler,
 * instead of an HTTP round-trip to a separately deployed Cloud Function).
 */
export const runtime = "nodejs";

const bdPhone = z
  .string()
  .regex(/^01[3-9]\d{8}$/, { message: "ফোন নম্বর সঠিক নয় (01XXXXXXXXX)" });

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  ownerName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  phone: bdPhone,
  district: z.string().optional().default(""),
  planId: z.enum(["basic", "standard", "premium"]),
  subscriptionStartedAt: z.string().min(1),
  subscriptionEndsAt: z.string().min(1),
  orderIdPrefix: z
    .string()
    .min(1)
    .max(6)
    .regex(/^[A-Z0-9-]+$/),
  createdByAdminId: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  let callerUid: string;
  // বাগ-ফিক্স (১৮ আগস্ট ২০২৬ লাইভ-অডিট): Tenant Details পেজে "Activated By"
  // আগে শুধু raw UID (`activatedBy`) দেখাত। এখন ইমেইলও সেভ হয় যাতে UI
  // মানুষ-পড়ার-যোগ্য মান দেখাতে পারে (দেখুন নিচে `activatedByEmail`)।
  let callerEmail = "";
  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.role !== "super_admin") {
      return NextResponse.json(
        { message: "Forbidden — super_admin only" },
        { status: 403 }
      );
    }
    callerUid = decoded.uid;
    callerEmail = decoded.email ?? "";
  } catch {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTenantSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  try {
    const userRecord = await auth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.ownerName,
    });

    const uid = userRecord.uid;
    const now = Timestamp.now();
    const startedAt = Timestamp.fromDate(new Date(data.subscriptionStartedAt));
    const endsAt = Timestamp.fromDate(new Date(data.subscriptionEndsAt));
    // UPDATE (৩১ জুলাই ২০২৬, audit #9): read the live subscription_plans/{planId}
    // doc (same collection EditPlanModal writes to) so Super Admin's feature
    // toggles take effect here too, not just on the client-side
    // createTenantDocument()/activateTenant() path. Falls back to the
    // hardcoded DEFAULT_PLAN_FEATURES constant if the doc doesn't exist yet
    // or predates the `features` field.
    const planSnap = await db.collection("subscription_plans").doc(data.planId).get();
    const planDocFeatures = planSnap.exists ? (planSnap.data()?.features as PlanFeatures | undefined) : undefined;
    const features = planDocFeatures ?? DEFAULT_PLAN_FEATURES[data.planId];
    const slug = generateSlug(data.name);

    const tenantRef = db.collection("tenants").doc(uid);
    const batch = db.batch();

    batch.set(tenantRef, {
      id: uid,
      name: data.name,
      slug,
      ownerName: data.ownerName,
      email: data.email,
      phone: data.phone,
      address: "",
      district: data.district,
      logoUrl: "",
      invoiceFooterMessage: "",
      notificationTemplates: DEFAULT_NOTIFICATION_TEMPLATES,
      planId: data.planId,
      planFeatures: features,
      featureOverrides: {},
      subscriptionStatus: "active",
      subscriptionStartedAt: startedAt,
      subscriptionEndsAt: endsAt,
      trialStartedAt: null,
      trialEndsAt: null,
      isTrial: false,
      signupSource: "admin_created",
      activatedBy: callerUid,
      activatedByEmail: callerEmail,
      activatedAt: now,
      paymentNotes: "",
      orderIdPrefix: data.orderIdPrefix,
      settings: {
        defaultCommissionRate: 10,
        defaultDeliveryDays: 3,
        currency: "BDT",
        language: "bn",
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const histRef = db
      .collection("tenants")
      .doc(uid)
      .collection("subscription_history")
      .doc();
    batch.set(histRef, {
      id: histRef.id,
      tenantId: uid,
      planId: data.planId,
      status: "active",
      startedAt,
      endsAt,
      activatedBy: callerUid,
      paymentNotes: "",
      createdAt: now,
    });

    const auditRef = db
      .collection("tenants")
      .doc(uid)
      .collection("audit_logs")
      .doc();
    batch.set(auditRef, {
      id: auditRef.id,
      tenantId: uid,
      userId: callerUid,
      userEmail: "super_admin",
      action: "tenant.created",
      resourceType: "tenant",
      resourceId: uid,
      changes: { signupSource: "admin_created", planId: data.planId },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
      userAgent: req.headers.get("user-agent") ?? "",
      createdAt: now,
    });

    // বাগ-ফিক্স (১৫ আগস্ট ২০২৬, শূন্য-শাখা / একক-মালিক): app/api/auth/signup
    // route-এর মতো এখানেও কোনো ডিফল্ট branches/{branchId} ডকুমেন্ট তৈরি হতো
    // না — Super Admin দিয়ে তৈরি করা একক-মালিক টেন্যান্টও তাই একই কারণে
    // অর্ডার/কোটেশন/কস্টিং তৈরি করতে পারতেন না। একই "প্রধান শাখা" fallback
    // এখানেও যোগ করা হলো, signup route-এর সাথে সামঞ্জস্যপূর্ণ রেখে।
    const branchRef = db.collection("tenants").doc(uid).collection("branches").doc();
    batch.set(branchRef, {
      id: branchRef.id,
      tenantId: uid,
      name: "প্রধান শাখা",
      address: "",
      phone: null,
      branchManagerId: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();

    await auth.setCustomUserClaims(uid, {
      tenantId: uid,
      role: "tenant_admin",
      isActive: true,
      isTrial: false,
    });

    return NextResponse.json({ success: true, tenantId: uid }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (process.env.NODE_ENV !== "production") {
      console.error("[POST /api/super-admin/create-tenant]", err);
    }
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
