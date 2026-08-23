import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { DEFAULT_PLAN_FEATURES, normalizePhone } from "@/lib/server/plan-features";
import { getClientIp } from "@/lib/server/request-ip";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/server/rate-limit";

/**
 * POST /api/portal/track
 *
 * Free Edition: this is no longer a proxy to the Cloud Function
 * `getPortalOrderStatus` (Firebase Spark plan cannot deploy Cloud
 * Functions). The exact same business/security logic that lived in
 * `functions/src/portalFunctions.ts::getPortalOrderStatus` now runs
 * directly here using the Firebase Admin SDK (`lib/firebase/admin.ts`,
 * which bypasses Firestore security rules the same way the Admin SDK
 * inside a Cloud Function did).
 *
 * This route remains the ONLY path a customer's browser has into order
 * data (blueprint T-20: "অর্ডার নম্বর দিয়ে ট্র্যাকিং, লগইন ছাড়াও"):
 * `firestore.rules` still has no public `allow read` on `orders` — opening
 * one would let anyone enumerate every order of every tenant by guessing
 * sequential order numbers. Instead, this server-side handler requires
 * BOTH the order number AND the exact phone number on that order, and
 * returns an identical "not found" response whether the order doesn't
 * exist or the phone doesn't match, so order numbers can never be used to
 * probe for a real customer's phone number.
 *
 * No business rule was changed or dropped in this migration — only the
 * transport (direct Admin SDK call inside this Next.js route handler,
 * instead of an HTTP round-trip to a separately deployed Cloud Function).
 *
 * SECURITY FIX (audit item #2, ৩০ জুলাই ২০২৬): this route previously had
 * no rate limiting at all, despite being the one place a phone number can
 * be brute-forced against a known order number. Now rate-limited two ways
 * — see the checks at the top of POST() — via lib/server/rate-limit.ts.
 */
export const runtime = "nodejs";

const trackSchema = z.object({
  tenantId: z.string().min(1),
  orderNumber: z.string().min(1).max(40),
  phone: z.string().min(6).max(20),
});

function toIso(ts: Timestamp | null | undefined): string | null {
  return ts ? ts.toDate().toISOString() : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // SECURITY FIX (audit item #2, ৩০ জুলাই ২০২৬): "orderNumber + phone
  // brute-force করে গ্রাহকের নাম/ফোন/ঠিকানা/অর্ডার ডিটেইলস বের করা সম্ভব।"
  // Two independent throttles, since either alone leaves a gap:
  //   - IP-based: stops one script/IP from hammering many different
  //     order numbers.
  //   - per (tenantId, orderNumber): stops someone from cycling through
  //     many *phone number guesses* against one specific target order —
  //     the exact threat model described in the audit — even if they
  //     rotate IPs to dodge the IP-based limit above.
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`portal_track_ip:${ip}`, 20, 10 * 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "অনেকবার চেষ্টা করা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন" },
      rateLimitResponseInit(ipLimit)
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (typeof rawBody !== "object" || rawBody === null) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const parsed = trackSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ message: "তথ্য সঠিক নয়" }, { status: 400 });
  }
  const { tenantId, orderNumber, phone } = parsed.data;

  const orderLimit = await checkRateLimit(`portal_track_order:${tenantId}:${orderNumber}`, 8, 15 * 60);
  if (!orderLimit.allowed) {
    return NextResponse.json(
      { message: "অনেকবার চেষ্টা করা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন" },
      rateLimitResponseInit(orderLimit)
    );
  }

  const db = getAdminDb();
  const notFound = () =>
    NextResponse.json(
      { message: "অর্ডার পাওয়া যায়নি — অর্ডার নম্বর ও মোবাইল নম্বর যাচাই করুন" },
      { status: 404 }
    );

  try {
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) {
      return NextResponse.json({ message: "প্রতিষ্ঠান পাওয়া যায়নি" }, { status: 404 });
    }
    const tenant = tenantSnap.data() as Record<string, unknown>;

    if (tenant.isActive !== true) {
      return NextResponse.json(
        { message: "এই প্রতিষ্ঠানের সাবস্ক্রিপশন সক্রিয় নেই" },
        { status: 403 }
      );
    }

    const planId = (tenant.planId as "basic" | "standard" | "premium") || "basic";
    const overrides = (tenant.featureOverrides as Record<string, boolean>) || {};
    const effectiveFeatures = { ...DEFAULT_PLAN_FEATURES[planId], ...overrides };
    if (!effectiveFeatures.customerPortal) {
      return NextResponse.json(
        { message: "গ্রাহক পোর্টাল এই প্যাকেজে অন্তর্ভুক্ত নয়" },
        { status: 403 }
      );
    }

    const orderQuery = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("orders")
      .where("orderNumber", "==", orderNumber)
      .where("deletedAt", "==", null)
      .limit(1)
      .get();

    if (orderQuery.empty) {
      return notFound();
    }

    const orderDoc = orderQuery.docs[0];
    if (!orderDoc) {
      return notFound();
    }
    const order = orderDoc.data();

    if (normalizePhone(String(order.customerPhone || "")) !== normalizePhone(phone)) {
      return notFound();
    }

    const [itemsSnap, branchSnap] = await Promise.all([
      orderDoc.ref.collection("order_items").orderBy("sortOrder", "asc").get(),
      order.branchId
        ? db
            .collection("tenants")
            .doc(tenantId)
            .collection("branches")
            .doc(order.branchId as string)
            .get()
        : Promise.resolve(null),
    ]);

    const items = itemsSnap.docs.map((d) => {
      const item = d.data();
      return {
        id: d.id,
        itemName: item.itemName as string,
        description: (item.description as string) || "",
        quantity: item.quantity as number,
        unitPrice: item.unitPrice as number,
        lineTotal: item.lineTotal as number,
      };
    });

    return NextResponse.json({
      tenant: {
        name: tenant.name,
        logoUrl: tenant.logoUrl || "",
        address: tenant.address || "",
        invoiceFooterMessage: tenant.invoiceFooterMessage || "",
      },
      branch:
        branchSnap && branchSnap.exists
          ? {
              name: branchSnap.data()?.name || "",
              address: branchSnap.data()?.address || "",
            }
          : null,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        isUrgent: !!order.isUrgent,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        createdAt: toIso(order.createdAt as Timestamp | null | undefined),
        updatedAt: toIso(order.updatedAt as Timestamp | null | undefined),
        expectedDeliveryDate: toIso(order.expectedDeliveryDate as Timestamp | null | undefined),
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        adjustment: order.adjustment,
        totalAmount: order.totalAmount,
        advanceAmount: order.advanceAmount,
        dueAmount: order.dueAmount,
      },
      items,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[POST /api/portal/track]", err);
    }
    return NextResponse.json(
      { message: "একটি সমস্যা হয়েছে, আবার চেষ্টা করুন" },
      { status: 500 }
    );
  }
}
