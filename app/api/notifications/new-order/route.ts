import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

/**
 * POST /api/notifications/new-order
 *
 * Free Edition: replaces the Cloud Function `notifyOnNewOrder`
 * (`functions/src/notificationFunctions.ts`) — a Firestore `onCreate`
 * trigger on `tenants/{tenantId}/orders/{orderId}`.
 *
 * Direct-Call Pattern (blueprint অংশ ১.২):
 *   The client calls this route immediately after a successful
 *   `createOrder()` Firestore write.
 *
 * Security model:
 *   Bearer ID-token verified server-side. The tenantId is taken from the
 *   verified custom claim — never trusted from the request body. The
 *   decoded role must be an active member of that tenant (any role may
 *   create orders, blueprint section 3.2), so we only require isActive +
 *   matching tenantId claim (not tenant_admin exclusively).
 *
 *   SEC-002 fix (১৬ আগস্ট ২০২৬ external audit): `orderId` must now
 *   reference a real order document in this tenant — `branchId`,
 *   `orderNumber`, and `customerName` are always read from that order
 *   document server-side, never trusted from the request body. Previously
 *   any active tenant user could POST arbitrary values for all four
 *   fields, writing a spoofed/fabricated in-app notification (fake order
 *   number, fake customer name, a link to a nonexistent or unrelated
 *   order) with no verification that the order actually existed.
 *
 * Idempotency:
 *   Uses a deterministic docId `newOrder_{orderId}` (same convention as
 *   the original Cloud Function, which derived no docId — but to survive
 *   client retries we use a stable ID so a second call is a no-op set
 *   instead of creating a duplicate notification document).
 *
 * Business rules preserved from notifyOnNewOrder:
 *   - type: "new_order"
 *   - titleKey: "notifications.messages.newOrder"
 *   - params: { orderNumber, customerName }
 *   - link: `/dashboard/orders/{orderId}`
 *   - readBy: []
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  orderId: z.string().min(1),
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

  // ── 3. Load the real order — SEC-002 fix: never trust client-supplied
  //      branchId/orderNumber/customerName ─────────────────────────────
  try {
    const db = getAdminDb();

    const orderSnap = await db.collection("tenants").doc(tenantId).collection("orders").doc(body.orderId).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "অর্ডার পাওয়া যায়নি" }, { status: 404 });
    }
    const order = orderSnap.data()!;

    const docId = `newOrder_${body.orderId}`;
    const notifRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("notifications")
      .doc(docId);

    await notifRef.set({
      id: docId,
      tenantId,
      branchId: (order.branchId as string) ?? "",
      type: "new_order",
      titleKey: "notifications.messages.newOrder",
      params: {
        orderNumber: (order.orderNumber as string) ?? "",
        customerName: (order.customerName as string) ?? "",
      },
      link: `/dashboard/orders/${body.orderId}`,
      readBy: [],
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/notifications/new-order]", err);
    }
    return NextResponse.json(
      { error: "নোটিফিকেশন তৈরি করা যায়নি" },
      { status: 500 }
    );
  }
}
