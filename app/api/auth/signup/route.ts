import { type NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/server/request-ip";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/server/rate-limit";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  TRIAL_FEATURES,
  generateSlug,
} from "@/lib/server/plan-features";

/**
 * POST /api/auth/signup
 *
 * Free Edition: this is no longer a proxy to the Cloud Function
 * `onTenantSelfSignup` (Firebase Spark plan cannot deploy Cloud Functions).
 * The exact same business logic that lived in
 * `functions/src/tenantFunctions.ts::onTenantSelfSignup` now runs directly
 * here using the Firebase Admin SDK (`lib/firebase/admin.ts`):
 *
 *   1. Validate the signup payload (same rules as the Cloud Function's zod
 *      schema — Bangladeshi phone format, password length, etc.)
 *   2. Create the Firebase Auth user
 *   3. Create the Firestore `tenants/{uid}` document with
 *      subscriptionStatus: 'trial', a 3-day trial window (blueprint 4.1),
 *      and every plan feature enabled (trial = full software)
 *   4. Write a `tenant.self_signup` audit log entry
 *   5. Set the `tenantId` / `role: 'tenant_admin'` / `isActive` / `isTrial`
 *      custom claims that `firestore.rules` and `middleware.ts` both check
 *   6. Best-effort notify every super admin of the new trial (never fails
 *      the signup itself if this step errors)
 *
 * No business rule was changed or dropped in this migration — only the
 * transport (direct Admin SDK call inside this Next.js route handler,
 * instead of an HTTP round-trip to a separately deployed Cloud Function).
 */
export const runtime = "nodejs";

const bdPhone = z
  .string()
  .regex(/^01[3-9]\d{8}$/, { message: "ফোন নম্বর সঠিক নয় (01XXXXXXXXX)" });

const selfSignupSchema = z.object({
  pressName: z.string().min(2).max(100),
  ownerName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  phone: bdPhone,
  district: z.string().optional().default(""),
});

const TRIAL_DURATION_DAYS = 3;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // SECURITY FIX (audit item #2, ৩০ জুলাই ২০২৬): "কেউ script দিয়ে অসীম
  // ট্রায়াল tenant বানাতে পারবে (spam signup)" — no rate limiting existed
  // on this public, unauthenticated route at all. 5 signups per hour per
  // IP is generous for a real small-business owner (who signs up once)
  // while blocking scripted bulk trial creation. Checked before touching
  // the request body at all, so a flood of requests can't even reach the
  // Zod validation / Admin SDK calls below.
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`signup:${ip}`, 5, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "অনেকবার চেষ্টা করা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন" },
      rateLimitResponseInit(rateLimit)
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = selfSignupSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const auth = getAdminAuth();
  const db = getAdminDb();

  try {
    const userRecord = await auth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.ownerName,
    });

    const uid = userRecord.uid;
    const now = new Date();
    const trialEnds = new Date(now.getTime() + TRIAL_DURATION_DAYS * 86400000);
    const nowTs = Timestamp.fromDate(now);
    const trialEndsTs = Timestamp.fromDate(trialEnds);
    const slug = generateSlug(data.pressName);

    const batch = db.batch();

    const tenantRef = db.collection("tenants").doc(uid);
    batch.set(tenantRef, {
      id: uid,
      name: data.pressName,
      slug,
      ownerName: data.ownerName,
      email: data.email,
      phone: data.phone,
      address: "",
      district: data.district,
      logoUrl: "",
      invoiceFooterMessage: "",
      notificationTemplates: DEFAULT_NOTIFICATION_TEMPLATES,
      planId: "premium",
      planFeatures: TRIAL_FEATURES,
      featureOverrides: {},
      subscriptionStatus: "trial",
      subscriptionStartedAt: null,
      subscriptionEndsAt: null,
      trialStartedAt: nowTs,
      trialEndsAt: trialEndsTs,
      isTrial: true,
      signupSource: "self_signup",
      activatedBy: null,
      activatedAt: null,
      paymentNotes: "",
      // AUDIT-REPORT-5 Issue #3 fix (৪ আগস্ট ২০২৬): was "PP" (no trailing
      // dash), which made every self-signup tenant's order numbers render
      // as "PP2026-0001" instead of the blueprint-documented "PP-2026-0001"
      // format (netlify/functions/generate-order-numbers.mts's "PP-"
      // fallback only ever applied to legacy tenants missing this field
      // entirely, so it never actually corrected new signups). Existing
      // tenants already created with "PP" keep their current prefix
      // unchanged — this only affects tenants signing up from now on.
      orderIdPrefix: "PP-",
      settings: {
        defaultCommissionRate: 10,
        defaultDeliveryDays: 3,
        currency: "BDT",
        language: "bn",
      },
      isActive: true,
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    const auditRef = db
      .collection("tenants")
      .doc(uid)
      .collection("audit_logs")
      .doc();
    batch.set(auditRef, {
      id: auditRef.id,
      tenantId: uid,
      userId: uid,
      userEmail: data.email,
      action: "tenant.self_signup",
      resourceType: "tenant",
      resourceId: uid,
      changes: { trialEndsAt: trialEnds.toISOString() },
      ipAddress: ip === "unknown" ? "" : ip,
      userAgent: req.headers.get("user-agent") ?? "",
      createdAt: nowTs,
    });

    // বাগ-ফিক্স (১৫ আগস্ট ২০২৬, শূন্য-শাখা / একক-মালিক): এই রুট কখনো কোনো
    // ডিফল্ট branches/{branchId} ডকুমেন্ট তৈরি করতো না। ফলে নিজে থেকে
    // সাইনআপ করা একক-মালিক টেন্যান্ট (কোনো স্টাফ/ম্যানেজার/শাখা নেই) —
    // যা সবচেয়ে সাধারণ কেস — branchId পাওয়ার কোনো উপায় ছাড়াই থেকে যেতেন,
    // এবং lib/validations/order.ts ও quotation.ts-এ branchId হার্ড-রিকোয়ার্ড
    // থাকায় তারা কোনো অর্ডার/কোটেশন/কস্টিং তৈরি করতে পারতেন না।
    // app/api/branches/create-এর মতো একই ডকুমেন্ট আকৃতিতে একটা "প্রধান
    // শাখা" এখানে সম্পূর্ণ নিঃশব্দে তৈরি করা হচ্ছে — ব্যবহারকারী কখনো এর
    // অস্তিত্ব টের পাবেন না, শুধু ব্যাকগ্রাউন্ডে সব ফিচার কাজ করার জন্য
    // দরকারি branchId পাওয়া যাবে। settings.branch ট্যাব থেকে পরে তিনি
    // চাইলে এই শাখার নাম/ঠিকানা এডিট করতে পারবেন (multiBranch ফিচার-ফ্ল্যাগ
    // ছাড়াই — দেখুন app/(tenant)/dashboard/settings/page.tsx)।
    // firestore.rules-এর branches collection-এ "allow create: if false"
    // থাকলেও এটা শুধু client SDK-কে আটকায় — Admin SDK (এই রুট) rules
    // সম্পূর্ণ বাইপাস করে, তাই এখানে কোনো rule পরিবর্তনের দরকার নেই।
    const branchRef = db.collection("tenants").doc(uid).collection("branches").doc();
    batch.set(branchRef, {
      id: branchRef.id,
      tenantId: uid,
      name: "প্রধান শাখা",
      address: "",
      phone: null,
      branchManagerId: null,
      isActive: true,
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    await batch.commit();

    await auth.setCustomUserClaims(uid, {
      tenantId: uid,
      role: "tenant_admin",
      isActive: true,
      isTrial: true,
    });

    // Notify super admins (best-effort — don't fail signup if this errors)
    try {
      const superAdmins = await db.collection("super_admins").get();
      if (!superAdmins.empty) {
        const notifBatch = db.batch();
        superAdmins.docs.forEach((doc) => {
          const notifRef = db
            .collection("super_admins")
            .doc(doc.id)
            .collection("notifications")
            .doc();
          notifBatch.set(notifRef, {
            type: "new_trial",
            tenantId: uid,
            tenantName: data.pressName,
            ownerName: data.ownerName,
            phone: data.phone,
            email: data.email,
            createdAt: nowTs,
            read: false,
          });
        });
        await notifBatch.commit();
      }
    } catch {
      /* non-critical — signup already succeeded */
    }

    return NextResponse.json({ tenantId: uid, uid }, { status: 201 });
  } catch (err) {
    const rawCode = (err as { code?: string })?.code;
    const code =
      rawCode === "auth/email-already-exists"
        ? "auth/email-already-in-use"
        : rawCode;
    const msg = err instanceof Error ? err.message : "unknown";
    if (process.env.NODE_ENV !== "production") {
      console.error("[POST /api/auth/signup]", err);
    }
    return NextResponse.json(
      { message: msg, code },
      { status: code === "auth/email-already-in-use" ? 409 : 500 }
    );
  }
}
