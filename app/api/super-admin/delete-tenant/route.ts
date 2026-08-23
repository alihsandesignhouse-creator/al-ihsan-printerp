import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

/**
 * POST /api/super-admin/delete-tenant
 *
 * ৯-সেশন পরিকল্পনার সেশন ৯ (সবচেয়ে ঝুঁকিপূর্ণ আইটেম, ১৮ আগস্ট ২০২৬)।
 * Product decision (PENDING_TASKS.md-এ কনফার্ম করা): এটা সত্যিকারের
 * সম্পূর্ণ HARD DELETE — soft-delete/status-flip নয়। "Suspended" স্ট্যাটাস
 * আলাদাভাবে ডেটা-ধরে-রাখা লক কভার করে (lib/firebase/tenants.ts-এর
 * setTenantSuspended()), তাই এখানে কোনো ডেটা রাখার প্রয়োজন নেই — উদ্দেশ্যই
 * হলো সম্পূর্ণ মুছে ফেলা।
 *
 * এই Cloud Function-এর কোনো পূর্বসূরি নেই (মূল ব্লুপ্রিন্টে/Cloud Functions
 * কোডবেসে কখনো ছিল না) — সম্পূর্ণ নতুন ফিচার, শুধু Free Edition Admin SDK
 * route হিসেবেই লেখা হলো।
 *
 * কী মুছে যায়:
 *   1. Firestore: `tenants/{tenantId}` ডকুমেন্ট + এর নিচের **সব**
 *      সাব-কালেকশন, যেকোনো গভীরতায় — `db.recursiveDelete()` ব্যবহার করা
 *      হয়েছে (firebase-admin SDK-এর নিজস্ব রিকার্সিভ ডিলিট, অভ্যন্তরীণভাবে
 *      BulkWriter দিয়ে ব্যাচ+রেট-লিমিট করে)। এটা প্রতিটা সাব-কালেকশনের নাম
 *      হাতে ধরে তালিকা করে আলাদা batch delete লেখার চেয়ে বেশি নিরাপদ —
 *      কোনো কালেকশন (orders, order_items, customers, payments, suppliers,
 *      supplier_transactions, users, expenses, quotations, quotation_items,
 *      stock_items, stock_transactions, cost_templates, zakat_years,
 *      zakat_payments, audit_logs, notifications, branches,
 *      subscription_history, staff_withdrawals, outsource_records —
 *      lib/firebase/*.ts-এ ব্যবহৃত সব tenant সাব-কালেকশন) বাদ পড়ার সুযোগ
 *      নেই, ভবিষ্যতে নতুন সাব-কালেকশন যোগ হলেও এই কোড না বদলেই কভার হবে।
 *   2. Firebase Auth: tenant_admin-এর user (tenantId নিজেই তার UID —
 *      দেখুন create-tenant/route.ts) + `tenants/{tenantId}/users/*`-এর
 *      প্রতিটা স্টাফের Auth user (প্রতিটা ডকুমেন্টের id-ই তাদের UID —
 *      দেখুন app/api/staff/create/route.ts)। এগুলো recursiveDelete()-এর
 *      অংশ না (Auth আলাদা সিস্টেম), তাই আলাদাভাবে auth.deleteUser() কল
 *      করা হয়েছে — প্রতিটা best-effort (একজনের ব্যর্থতা বাকিদের আটকাবে
 *      না, ইতিমধ্যে deleted/not-found হলে চুপচাপ স্কিপ)।
 *
 * ডিলিট-পূর্ব audit রেকর্ড: tenant নিজেই মুছে যাচ্ছে বলে তার নিজের
 * audit_logs সাব-কালেকশনও মুছে যাবে — তাই এই ঘটনার একটা স্থায়ী প্রমাণ
 * top-level `tenant_deletion_log` কালেকশনে (নতুন, tenant-এর নিচে না)
 * ডেটা মোছার আগেই লেখা হয়। firestore.rules-এর ব্ল্যাঙ্কেট
 * `match /{document=**} { allow read, write: if isSuperAdmin(); }` rule
 * এটা এমনিতেই কভার করে — কোনো rules পরিবর্তন লাগেনি (append-only নীতি
 * অক্ষত)।
 *
 * নিরাপত্তা: শুধু নাম টাইপ-করে-কনফার্ম UI যথেষ্ট না বলে, সার্ভার সাইডেও
 * request body-র tenantNameConfirmation === প্রকৃত tenant.name (exact
 * match) আবার যাচাই করা হয় — client-side ভ্যালিডেশন বাইপাস করে সরাসরি এই
 * route কল করলেও ভুল/অসাবধান ডিলিট আটকাবে।
 *
 * সতর্কতা (README/SETUP-TESTING.md-এও নথিভুক্ত): recursiveDelete() বড়
 * টেন্যান্টে (হাজার হাজার অর্ডার/order_items) কিছুটা সময় নিতে পারে।
 * Netlify serverless function-এর ডিফল্ট টাইমআউট (~১০ সেকেন্ড Free/Starter
 * প্ল্যানে) অতিক্রম করার তাত্ত্বিক ঝুঁকি আছে — recursiveDelete()
 * ব্যাকগ্রাউন্ডে নিজে থেকেই থামে না, তাই টাইমআউট হলে আংশিক ডিলিট অবস্থায়
 * থাকতে পারে (আবার একই রুট কল করলে recursiveDelete() নিরাপদে বাকি অংশ
 * চালিয়ে যাবে, কারণ ইতিমধ্যে-ডিলিট-হওয়া ডকুমেন্টে দ্বিতীয়বার delete()
 * কল করা নিরাপদ/idempotent)। প্রকৃত প্রোডাকশন ট্রাফিকে যাওয়ার আগে
 * emulator-এ একটা টেস্ট-টেন্যান্ট (কিছু অর্ডার/স্টাফ সহ) বানিয়ে এই route
 * ম্যানুয়ালি যাচাই করার নির্দেশনা SETUP-TESTING.md-এ যোগ করা হয়েছে।
 */

export const runtime = "nodejs";
// দ্রষ্টব্য: `maxDuration` route-segment config ইচ্ছাকৃতভাবে সেট করা হয়নি —
// এটা Vercel-নির্দিষ্ট (Main Edition-এর জন্য কার্যকর, Free Edition-এর
// Netlify রানটাইমে এর কোনো প্রভাব নেই, ভুল প্রত্যাশা তৈরি করত)। Netlify-তে
// function timeout netlify.toml/প্ল্যান লিমিট দিয়ে নিয়ন্ত্রিত হয় — ওপরের
// হেডার কমেন্টে টাইমআউট-ঝুঁকি ও idempotent রিট্রাই নোট করা আছে।

const bodySchema = z.object({
  tenantId: z.string().min(1),
  tenantNameConfirmation: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Verify super_admin identity ─────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  const auth = getAdminAuth();
  const db = getAdminDb();

  let callerUid: string;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 403 });
    }
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 401 });
  }

  // ── 2. Validate request body ───────────────────────────────────────────
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const { tenantId, tenantNameConfirmation } = body;

  // ── 3. Fetch tenant + re-verify the type-to-confirm name server-side ───
  const tenantRef = db.collection("tenants").doc(tenantId);
  let tenantData: FirebaseFirestore.DocumentData;
  try {
    const snap = await tenantRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: "Tenant not found" }, { status: 404 });
    }
    tenantData = snap.data() as FirebaseFirestore.DocumentData;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/super-admin/delete-tenant] fetch tenant", err);
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  if (tenantNameConfirmation !== tenantData.name) {
    return NextResponse.json(
      { message: "Confirmation name does not match — deletion aborted" },
      { status: 400 }
    );
  }

  // ── 4. Collect Auth UIDs to delete (tenant_admin + every staff member) ─
  const authUidsToDelete = new Set<string>([tenantId]); // tenants/{uid}, tenantId is the tenant_admin's Auth UID
  try {
    const usersSnap = await tenantRef.collection("users").get();
    usersSnap.docs.forEach((d) => authUidsToDelete.add(d.id));
  } catch (err) {
    // Non-fatal — proceed with just the tenant_admin UID if the users
    // subcollection can't be read for some reason; recursiveDelete below
    // still removes their Firestore documents either way.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/super-admin/delete-tenant] list users failed", err);
    }
  }

  // ── 5. Write a permanent deletion record BEFORE destroying the data ────
  // Top-level collection (not under tenants/{tenantId}) so this survives
  // the recursiveDelete below — the tenant's own audit_logs won't.
  try {
    const logRef = db.collection("tenant_deletion_log").doc();
    await logRef.set({
      id: logRef.id,
      tenantId,
      tenantName: tenantData.name ?? null,
      ownerName: tenantData.ownerName ?? null,
      email: tenantData.email ?? null,
      phone: tenantData.phone ?? null,
      planId: tenantData.planId ?? null,
      subscriptionStatus: tenantData.subscriptionStatus ?? null,
      deletedAuthUserCount: authUidsToDelete.size,
      deletedByAdminId: callerUid,
      deletedAt: Timestamp.now(),
    });
  } catch (err) {
    // Non-fatal, but worth knowing about if it happens.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/super-admin/delete-tenant] deletion log write failed", err);
    }
  }

  // ── 6. Recursively delete the tenant document + every subcollection ────
  try {
    await db.recursiveDelete(tenantRef);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/super-admin/delete-tenant] recursiveDelete failed", err);
    }
    return NextResponse.json(
      {
        message:
          "Tenant data deletion failed or was interrupted. Some data may have already been removed — calling this again is safe and will finish the rest.",
      },
      { status: 500 }
    );
  }

  // ── 7. Delete every Firebase Auth user tied to this tenant ─────────────
  let deletedAuthUsers = 0;
  await Promise.all(
    Array.from(authUidsToDelete).map(async (uid) => {
      try {
        await auth.deleteUser(uid);
        deletedAuthUsers += 1;
      } catch (err) {
        // best-effort — user may already be gone, or may never have had
        // a matching Auth account; either way this must not block the
        // response since the Firestore data is already gone.
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[api/super-admin/delete-tenant] deleteUser(${uid}) failed`, err);
        }
      }
    })
  );

  return NextResponse.json({ ok: true, deletedAuthUsers, totalAuthUsers: authUidsToDelete.size });
}
