import * as functionsV2 from "firebase-functions/v2/firestore";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Fires whenever a new quotation document is created. Replaces the
 * client-written temporary "OFFLINE-{timestamp}" quotationNumber with a
 * sequential, tenant-scoped number "QT-{year}-{0001}", per blueprint
 * section ৯ / মডিউল T-14 ("কোটেশন নম্বর: QT-2026-0001 (স্বয়ংক্রিয়)") and
 * following the exact same pattern as generateOrderNumber (T-02) — same
 * v2 firestore-trigger API generateOrderNumber already established in this
 * project (orderFunctions.ts).
 *
 * Uses its own per-tenant, per-year counter document (separate from the
 * order counter) so quotation numbering is sequential and gap-free even
 * under concurrent quotation creation.
 */
export const generateQuotationNumber = functionsV2.onDocumentCreated(
  {
    document: "tenants/{tenantId}/quotations/{quotationId}",
    region: "asia-south1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const quotation = snapshot.data();
    const existingNumber = quotation.quotationNumber as string | undefined;

    // Only replace temporary offline numbers; never renumber a quotation that
    // already has a final sequential number (avoids double-processing on
    // function retries).
    if (!existingNumber || !existingNumber.startsWith("OFFLINE-")) {
      return;
    }

    const { tenantId, quotationId } = event.params as { tenantId: string; quotationId: string };

    const year = new Date().getFullYear();
    const counterRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("counters")
      .doc(`quotation_${year}`);

    const quotationRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("quotations")
      .doc(quotationId);

    try {
      const finalNumber = await db.runTransaction(async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const nextSeq = ((counterSnap.data()?.lastSequence as number) || 0) + 1;
        tx.set(counterRef, { lastSequence: nextSeq, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

        const padded = String(nextSeq).padStart(4, "0");
        const number = `QT-${year}-${padded}`;
        tx.update(quotationRef, { quotationNumber: number, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return number;
      });

      logger.info(`generateQuotationNumber: assigned ${finalNumber} to quotation ${quotationId} (tenant ${tenantId})`);
    } catch (error) {
      logger.error("generateQuotationNumber: failed to assign sequential quotation number", {
        tenantId,
        quotationId,
        error,
      });
      // Leave the OFFLINE-{timestamp} number in place on failure; the
      // quotation remains valid and usable, just without the final number.
    }
  }
);

/**
 * Scheduled daily at 00:05 Asia/Dhaka (offset from checkTrialExpiry's 00:01
 * to avoid both cold-starting at the exact same instant). Auto-transitions
 * any quotation still in 'draft' or 'sent' whose validUntil date has passed
 * into 'expired' — per blueprint T-14 status list (Draft/Sent/Accepted/
 * Rejected/Expired). Quotations already 'accepted' or 'rejected' are a
 * final decision and are never auto-expired.
 *
 * Uses the v1 firebase-functions API (functions.region().pubsub.schedule())
 * to match the project's one existing scheduled function, checkTrialExpiry
 * (tenantFunctions.ts) — kept consistent rather than introducing a second,
 * differently-styled scheduler API for the same v5 firebase-functions SDK.
 */
export const checkQuotationExpiry = functions
  .region("asia-south1")
  .pubsub.schedule("5 0 * * *")
  .timeZone("Asia/Dhaka")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const tenantsSnap = await db.collection("tenants").get();

    let totalExpired = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const expiredQuery = await db
        .collection("tenants")
        .doc(tenantDoc.id)
        .collection("quotations")
        .where("deletedAt", "==", null)
        .where("validUntil", "<", now)
        .where("status", "in", ["draft", "sent"])
        .get();

      if (expiredQuery.empty) continue;

      const batch = db.batch();
      expiredQuery.docs.forEach((quotationDoc) => {
        batch.update(quotationDoc.ref, {
          status: "expired",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      totalExpired += expiredQuery.size;
    }

    if (process.env.NODE_ENV !== "production") {
      logger.info(`checkQuotationExpiry: expired ${totalExpired} quotation(s) across ${tenantsSnap.size} tenant(s)`);
    }
  });
