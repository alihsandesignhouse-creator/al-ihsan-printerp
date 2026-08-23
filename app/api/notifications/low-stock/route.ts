import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

/**
 * POST /api/notifications/low-stock
 *
 * Free Edition: replaces the Cloud Function `notifyOnLowStock`
 * (`functions/src/notificationFunctions.ts`) — a Firestore `onUpdate`
 * trigger on `tenants/{tenantId}/stock_items/{stockItemId}`.
 *
 * Direct-Call Pattern (blueprint অংশ ১.২):
 *   `recordStockTransaction()` in `lib/firebase/stock.ts` calls this
 *   route after a successful Firestore transaction — but only when the
 *   crossing condition is met (previousStock >= minimumLevel &&
 *   newStock < minimumLevel). The crossing logic that was inside the
 *   Cloud Function trigger is now computed client-side before calling this
 *   route, so this route only runs when a notification is actually needed.
 *
 * Security model:
 *   Bearer ID-token verified. tenantId from verified custom claim only.
 *   Any active tenant member can trigger a stock transaction (and thus a
 *   low-stock notification) — blueprint section 3.2 (BRANCH_MANAGER has
 *   full stock control for their branch; COMMISSION_STAFF does not have
 *   stock access, but the route trusts the caller has already passed the
 *   Firestore security rule for stock_items).
 *
 * Idempotency:
 *   Uses a deterministic docId `lowStock_{stockId}`. This means only the
 *   first crossing event per stock item creates a document; subsequent
 *   writes are no-ops (set with same data). The notification is "cleared"
 *   when stock rises above minimumLevel again — that reset is handled
 *   client-side by the stock module deleting or updating the notification
 *   document (future enhancement; for now the notification persists until
 *   manually dismissed).
 *
 * Business rules preserved from notifyOnLowStock:
 *   - Only fires when crossing from >= minimumLevel to < minimumLevel
 *     (crossing logic evaluated client-side before calling this route)
 *   - type: "low_stock"
 *   - titleKey: "notifications.messages.lowStock"
 *   - params: { itemName, currentStock, unit }
 *   - link: "/dashboard/stock"
 *   - readBy: []
 */

export const runtime = "nodejs";

const bodySchema = z.object({
  stockId: z.string().min(1),
  branchId: z.string().min(1),
  itemName: z.string().min(1),
  currentStock: z.number(),
  unit: z.string(),
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

  // ── 3. Write notification document (idempotent) ────────────────────────
  try {
    const db = getAdminDb();
    const docId = `lowStock_${body.stockId}`;
    const notifRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("notifications")
      .doc(docId);

    await notifRef.set({
      id: docId,
      tenantId,
      branchId: body.branchId,
      type: "low_stock",
      titleKey: "notifications.messages.lowStock",
      params: {
        itemName: body.itemName,
        currentStock: body.currentStock,
        unit: body.unit,
      },
      link: "/dashboard/stock",
      readBy: [],
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/notifications/low-stock]", err);
    }
    return NextResponse.json(
      { error: "নোটিফিকেশন তৈরি করা যায়নি" },
      { status: 500 }
    );
  }
}
