import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { DEFAULT_PLAN_FEATURES } from './tenantFunctions';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Module T-20 (গ্রাহক পোর্টাল, প্রিমিয়াম) — blueprint: "অর্ডার নম্বর দিয়ে
 * ট্র্যাকিং (লগইন ছাড়াও)"। Deliberately an `onRequest` Cloud Function using
 * the Admin SDK (bypasses Firestore security rules) rather than opening any
 * `tenants/{tenantId}/orders` read to anonymous/unauthenticated clients —
 * the alternative (a public `allow read` rule) would let anyone enumerate
 * every order of every tenant. This function is the ONLY path a customer's
 * browser has into order data, and it returns the minimum needed to render
 * a tracking page: no other customers, no other orders, no financial data
 * belonging to anyone but the caller who already knows both the order
 * number AND the phone number on that order.
 *
 * Proxied by app/api/portal/track/route.ts exactly like onTenantSelfSignup —
 * this is a plain onRequest function, not onCall, so it must be invoked with
 * fetch(), not the client SDK's httpsCallable wrapper.
 */

function normalizePhone(value: string): string {
  // Strips spaces, dashes, and a leading country code (+880 / 880 / 0) so
  // "01712345678", "+8801712345678", and "880 1712 345678" all compare equal.
  const digits = value.replace(/\D/g, '');
  return digits.slice(-10);
}

const trackSchema = z.object({
  tenantId: z.string().min(1),
  orderNumber: z.string().min(1).max(40),
  phone: z.string().min(6).max(20),
});

export const getPortalOrderStatus = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Method not allowed' });
      return;
    }

    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'তথ্য সঠিক নয়' });
      return;
    }
    const { tenantId, orderNumber, phone } = parsed.data;

    try {
      const tenantSnap = await db.collection('tenants').doc(tenantId).get();
      if (!tenantSnap.exists) {
        res.status(404).json({ message: 'প্রতিষ্ঠান পাওয়া যায়নি' });
        return;
      }
      const tenant = tenantSnap.data() as Record<string, unknown>;

      if (tenant.isActive !== true) {
        res.status(403).json({ message: 'এই প্রতিষ্ঠানের সাবস্ক্রিপশন সক্রিয় নেই' });
        return;
      }

      const planId = (tenant.planId as string) || 'basic';
      const overrides = (tenant.featureOverrides as Record<string, boolean>) || {};
      const effectiveFeatures = { ...DEFAULT_PLAN_FEATURES[planId], ...overrides };
      if (!effectiveFeatures.customerPortal) {
        res.status(403).json({ message: 'গ্রাহক পোর্টাল এই প্যাকেজে অন্তর্ভুক্ত নয়' });
        return;
      }

      const orderQuery = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('orders')
        .where('orderNumber', '==', orderNumber)
        .where('deletedAt', '==', null)
        .limit(1)
        .get();

      // Same "not found" response whether the order truly doesn't exist or
      // the phone doesn't match — never confirm order-number existence to a
      // caller who can't also prove the phone number, to prevent order
      // numbers (often sequential and guessable, e.g. PP-2026-0001) from
      // being used to probe for real customers' phone numbers.
      const notFound = () => res.status(404).json({ message: 'অর্ডার পাওয়া যায়নি — অর্ডার নম্বর ও মোবাইল নম্বর যাচাই করুন' });

      if (orderQuery.empty) {
        notFound();
        return;
      }

      const orderDoc = orderQuery.docs[0];
      const order = orderDoc.data();

      if (normalizePhone(String(order.customerPhone || '')) !== normalizePhone(phone)) {
        notFound();
        return;
      }

      const [itemsSnap, branchSnap] = await Promise.all([
        orderDoc.ref.collection('order_items').orderBy('sortOrder', 'asc').get(),
        order.branchId
          ? db.collection('tenants').doc(tenantId).collection('branches').doc(order.branchId as string).get()
          : Promise.resolve(null),
      ]);

      const items = itemsSnap.docs.map((d) => {
        const item = d.data();
        return {
          id: d.id,
          itemName: item.itemName as string,
          description: (item.description as string) || '',
          quantity: item.quantity as number,
          unitPrice: item.unitPrice as number,
          lineTotal: item.lineTotal as number,
        };
      });

      const toIso = (ts: admin.firestore.Timestamp | null | undefined) => (ts ? ts.toDate().toISOString() : null);

      res.status(200).json({
        tenant: {
          name: tenant.name,
          logoUrl: tenant.logoUrl || '',
          address: tenant.address || '',
          invoiceFooterMessage: tenant.invoiceFooterMessage || '',
        },
        branch:
          branchSnap && branchSnap.exists
            ? { name: branchSnap.data()?.name || '', address: branchSnap.data()?.address || '' }
            : null,
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          isUrgent: !!order.isUrgent,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          createdAt: toIso(order.createdAt),
          updatedAt: toIso(order.updatedAt),
          expectedDeliveryDate: toIso(order.expectedDeliveryDate),
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
      functions.logger.error('getPortalOrderStatus failed', err);
      res.status(500).json({ message: 'একটি সমস্যা হয়েছে, আবার চেষ্টা করুন' });
    }
  });
