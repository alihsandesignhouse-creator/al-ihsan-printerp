import * as functions from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Fires whenever a new order document is created. Replaces the client-written
 * temporary "OFFLINE-{timestamp}" orderNumber with a sequential, tenant-scoped
 * number in the form "{orderIdPrefix}{year}-{0001}" (e.g. "PP-2026-0001"),
 * per blueprint sections 5.4, 8/T-02, and 12.3.
 *
 * Uses a per-tenant, per-year counter document so numbering is sequential and
 * gap-free even under concurrent order creation (Firestore transactions
 * serialize the read-modify-write of the counter).
 */
export const generateOrderNumber = functions.onDocumentCreated(
  {
    document: "tenants/{tenantId}/orders/{orderId}",
    region: "asia-south1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const order = snapshot.data();
    const existingNumber = order.orderNumber as string | undefined;

    // Only replace temporary offline numbers; never renumber an order that
    // already has a final sequential number (avoids double-processing on
    // function retries).
    if (!existingNumber || !existingNumber.startsWith("OFFLINE-")) {
      return;
    }

    const { tenantId, orderId } = event.params as { tenantId: string; orderId: string };

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const orderIdPrefix = (tenantSnap.data()?.orderIdPrefix as string) || "PP-";

    const year = new Date().getFullYear();
    const counterRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("counters")
      .doc(`order_${year}`);

    const orderRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("orders")
      .doc(orderId);

    try {
      const finalNumber = await db.runTransaction(async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const nextSeq = ((counterSnap.data()?.lastSequence as number) || 0) + 1;
        tx.set(counterRef, { lastSequence: nextSeq, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

        const padded = String(nextSeq).padStart(4, "0");
        const number = `${orderIdPrefix}${year}-${padded}`;
        tx.update(orderRef, { orderNumber: number, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return number;
      });

      logger.info(`generateOrderNumber: assigned ${finalNumber} to order ${orderId} (tenant ${tenantId})`);
    } catch (error) {
      logger.error("generateOrderNumber: failed to assign sequential order number", {
        tenantId,
        orderId,
        error,
      });
      // Leave the OFFLINE-{timestamp} number in place on failure; the order
      // remains valid and usable, just without the final sequential number.
    }
  }
);
