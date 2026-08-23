import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { z } from 'zod';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// ─── Validation (mirrors client schema) ──────────────────────────────────

const bdPhone = z.string().regex(/^01[3-9]\d{8}$/);

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  ownerName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  phone: bdPhone,
  district: z.string().optional().default(''),
  planId: z.enum(['basic', 'standard', 'premium']),
  subscriptionStartedAt: z.string().min(1),
  subscriptionEndsAt: z.string().min(1),
  orderIdPrefix: z.string().min(1).max(6).regex(/^[A-Z0-9-]+$/),
  createdByAdminId: z.string().min(1),
});

// ─── Default plan features ────────────────────────────────────────────────

// Exported so portalFunctions.ts (Module T-20) can compute effective plan
// features the same way — client-provided tenantId is never trusted, but the
// stored planId + featureOverrides are, exactly like computeEffectiveFeatures
// in lib/firebase/tenants.ts. Avoids a third duplicate copy of this table.
export const DEFAULT_PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  basic: {
    costCalculator: false, costingManagement: false, commissionSystem: false,
    expenseManagement: false, quotations: false, stockManagement: false,
    supplierManagement: false, multiBranch: false, advancedReports: false,
    customBranding: false, smsNotifications: false, emailNotifications: false,
    whatsappNotifications: false,
    dataExport: false, outsourceTracking: false, customerPortal: false,
    prioritySupport: false,
  },
  standard: {
    costCalculator: true, costingManagement: true, commissionSystem: true,
    expenseManagement: true, quotations: true, stockManagement: true,
    supplierManagement: true, multiBranch: true, advancedReports: true,
    customBranding: true, smsNotifications: false, emailNotifications: false,
    whatsappNotifications: false,
    dataExport: false, outsourceTracking: false, customerPortal: false,
    prioritySupport: false,
  },
  premium: {
    costCalculator: true, costingManagement: true, commissionSystem: true,
    expenseManagement: true, quotations: true, stockManagement: true,
    supplierManagement: true, multiBranch: true, advancedReports: true,
    customBranding: true, smsNotifications: true, emailNotifications: true,
    whatsappNotifications: true,
    dataExport: true, outsourceTracking: true, customerPortal: true,
    prioritySupport: true,
  },
};

// Mirrors lib/types/tenant.ts DEFAULT_NOTIFICATION_TEMPLATES (functions/ is a
// standalone TS project — no cross-imports from the Next.js app's lib/).
const DEFAULT_NOTIFICATION_TEMPLATES = {
  sms: {
    orderConfirmation: 'আপনার অর্ডার {{orderNumber}} গ্রহণ করা হয়েছে। মোট বিল: {{totalAmount}} টাকা। ধন্যবাদ — {{pressName}}',
    deliveryReminder: 'আপনার অর্ডার {{orderNumber}} আজ ডেলিভারির জন্য প্রস্তুত। — {{pressName}}',
    paymentReceived: '{{amount}} টাকা পেমেন্ট গ্রহণ করা হয়েছে। বকেয়া: {{dueAmount}} টাকা। — {{pressName}}',
    dueReminder: 'আপনার অর্ডার {{orderNumber}}-এ {{dueAmount}} টাকা বকেয়া আছে। যোগাযোগ করুন। — {{pressName}}',
  },
  email: {
    orderConfirmation: 'প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}} গ্রহণ করা হয়েছে। মোট বিল: {{totalAmount}} টাকা।',
    deliveryReminder: 'প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}} আজ ডেলিভারির জন্য প্রস্তুত।',
    paymentReceived: 'প্রিয় {{customerName}}, {{amount}} টাকা পেমেন্ট গ্রহণ করা হয়েছে। বকেয়া: {{dueAmount}} টাকা।',
    dueReminder: 'প্রিয় {{customerName}}, আপনার অর্ডার {{orderNumber}}-এ {{dueAmount}} টাকা বকেয়া আছে।',
  },
};

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 40);
}

// ─── HTTP Cloud Function: Admin Creates Tenant ───────────────────────────

export const onAdminCreateTenant = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ message: 'Method not allowed' }); return; }

    // Verify caller is super_admin
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Unauthorized' }); return;
    }
    const idToken = authHeader.slice(7);
    let callerUid: string;
    try {
      const decoded = await auth.verifyIdToken(idToken);
      if (decoded.role !== 'super_admin') {
        res.status(403).json({ message: 'Forbidden — super_admin only' }); return;
      }
      callerUid = decoded.uid;
    } catch {
      res.status(401).json({ message: 'Invalid token' }); return;
    }

    // Validate body
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Validation failed', errors: parsed.error.issues }); return;
    }
    const data = parsed.data;

    try {
      // 1. Create Firebase Auth user
      const userRecord = await auth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.ownerName,
      });

      const uid = userRecord.uid;
      const now = admin.firestore.Timestamp.now();
      const startedAt = admin.firestore.Timestamp.fromDate(new Date(data.subscriptionStartedAt));
      const endsAt = admin.firestore.Timestamp.fromDate(new Date(data.subscriptionEndsAt));
      const features = DEFAULT_PLAN_FEATURES[data.planId];
      const slug = generateSlug(data.name);

      // 2. Create Firestore tenant document
      const tenantRef = db.collection('tenants').doc(uid);
      const batch = db.batch();

      batch.set(tenantRef, {
        id: uid,
        name: data.name,
        slug,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        address: '',
        district: data.district,
        logoUrl: '',
        invoiceFooterMessage: '',
        notificationTemplates: DEFAULT_NOTIFICATION_TEMPLATES,
        planId: data.planId,
        planFeatures: features,
        featureOverrides: {},
        subscriptionStatus: 'active',
        subscriptionStartedAt: startedAt,
        subscriptionEndsAt: endsAt,
        trialStartedAt: null,
        trialEndsAt: null,
        isTrial: false,
        signupSource: 'admin_created',
        activatedBy: callerUid,
        activatedAt: now,
        paymentNotes: '',
        orderIdPrefix: data.orderIdPrefix,
        settings: {
          defaultCommissionRate: 10,
          defaultDeliveryDays: 3,
          currency: 'BDT',
          language: 'bn',
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // 3. Write subscription history
      const histRef = db
        .collection('tenants').doc(uid)
        .collection('subscription_history').doc();
      batch.set(histRef, {
        id: histRef.id,
        tenantId: uid,
        planId: data.planId,
        status: 'active',
        startedAt,
        endsAt,
        activatedBy: callerUid,
        paymentNotes: '',
        createdAt: now,
      });

      // 4. Write audit log
      const auditRef = db
        .collection('tenants').doc(uid)
        .collection('audit_logs').doc();
      batch.set(auditRef, {
        id: auditRef.id,
        tenantId: uid,
        userId: callerUid,
        userEmail: 'super_admin',
        action: 'tenant.created',
        resourceType: 'tenant',
        resourceId: uid,
        changes: { signupSource: 'admin_created', planId: data.planId },
        ipAddress: req.ip ?? '',
        userAgent: req.headers['user-agent'] ?? '',
        createdAt: now,
      });

      await batch.commit();

      // 5. Set custom claims: tenantId, role, isActive
      await auth.setCustomUserClaims(uid, {
        tenantId: uid,
        role: 'tenant_admin',
        isActive: true,
        isTrial: false,
      });

      res.status(201).json({ success: true, tenantId: uid });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (process.env.NODE_ENV !== 'production') console.error('[onAdminCreateTenant]', err);
      res.status(500).json({ message: msg });
    }
  });

// ─── HTTP Cloud Function: Self Signup (Trial) ────────────────────────────

const selfSignupSchema = z.object({
  name: z.string().min(2).max(100),
  ownerName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  phone: bdPhone,
  district: z.string().optional().default(''),
});

const TRIAL_DURATION_DAYS = 3;
const TRIAL_FEATURES: Record<string, boolean> = DEFAULT_PLAN_FEATURES.premium;

export const onTenantSelfSignup = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ message: 'Method not allowed' }); return; }

    const parsed = selfSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Validation failed', errors: parsed.error.issues }); return;
    }
    const data = parsed.data;

    try {
      const userRecord = await auth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.ownerName,
      });

      const uid = userRecord.uid;
      const now = new Date();
      const trialEnds = new Date(now.getTime() + TRIAL_DURATION_DAYS * 86400000);
      const nowTs = admin.firestore.Timestamp.fromDate(now);
      const trialEndsTs = admin.firestore.Timestamp.fromDate(trialEnds);
      const slug = generateSlug(data.name);

      const batch = db.batch();

      const tenantRef = db.collection('tenants').doc(uid);
      batch.set(tenantRef, {
        id: uid,
        name: data.name,
        slug,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        address: '',
        district: data.district,
        logoUrl: '',
        invoiceFooterMessage: '',
        notificationTemplates: DEFAULT_NOTIFICATION_TEMPLATES,
        planId: 'premium', // Trial gets all features
        planFeatures: TRIAL_FEATURES,
        featureOverrides: {},
        subscriptionStatus: 'trial',
        subscriptionStartedAt: null,
        subscriptionEndsAt: null,
        trialStartedAt: nowTs,
        trialEndsAt: trialEndsTs,
        isTrial: true,
        signupSource: 'self_signup',
        activatedBy: null,
        activatedAt: null,
        paymentNotes: '',
        // AUDIT-REPORT-5 Issue #3 fix, এখানেও প্রয়োগ করা হলো (১৩ আগস্ট
        // ২০২৬) — app/api/auth/signup/route.ts (বর্তমান সক্রিয় Netlify
        // সাইনআপ পাথ)-এ এই একই ফিক্স আগেই করা হয়েছিল ("PP" → "PP-",
        // ট্রেইলিং ড্যাশ ছাড়া orderIdPrefix "PP2026-0001" রেন্ডার করত,
        // ব্লুপ্রিন্টের "PP-2026-0001" ফরম্যাটের বদলে)। এই ফাইলটা (legacy
        // Firebase Cloud Function, Netlify Functions দিয়ে প্রতিস্থাপিত)
        // সম্ভবত আর deploy হয় না, কিন্তু কোডবেস জুড়ে সামঞ্জস্যের জন্য এখানেও
        // ঠিক করা হলো।
        orderIdPrefix: 'PP-',
        settings: {
          defaultCommissionRate: 10,
          defaultDeliveryDays: 3,
          currency: 'BDT',
          language: 'bn',
        },
        isActive: true,
        createdAt: nowTs,
        updatedAt: nowTs,
      });

      const auditRef = db
        .collection('tenants').doc(uid)
        .collection('audit_logs').doc();
      batch.set(auditRef, {
        id: auditRef.id,
        tenantId: uid,
        userId: uid,
        userEmail: data.email,
        action: 'tenant.self_signup',
        resourceType: 'tenant',
        resourceId: uid,
        changes: { trialEndsAt: trialEnds.toISOString() },
        ipAddress: req.ip ?? '',
        userAgent: req.headers['user-agent'] ?? '',
        createdAt: nowTs,
      });

      await batch.commit();

      await auth.setCustomUserClaims(uid, {
        tenantId: uid,
        role: 'tenant_admin',
        isActive: true,
        isTrial: true,
      });

      // Notify super admins (best-effort — don't fail signup if this errors)
      try {
        const superAdmins = await db.collection('super_admins').get();
        const notifBatch = db.batch();
        superAdmins.docs.forEach((doc) => {
          const notifRef = db.collection('super_admins').doc(doc.id)
            .collection('notifications').doc();
          notifBatch.set(notifRef, {
            type: 'new_trial',
            tenantId: uid,
            tenantName: data.name,
            ownerName: data.ownerName,
            phone: data.phone,
            email: data.email,
            createdAt: nowTs,
            read: false,
          });
        });
        await notifBatch.commit();
      } catch { /* non-critical */ }

      res.status(201).json({ tenantId: uid, uid });
    } catch (err) {
      const rawCode = (err as { code?: string }).code;
      const code = rawCode === 'auth/email-already-exists' ? 'auth/email-already-in-use' : rawCode;
      const msg = err instanceof Error ? err.message : 'unknown';
      if (process.env.NODE_ENV !== 'production') console.error('[onTenantSelfSignup]', err);
      res.status(code === 'auth/email-already-in-use' ? 409 : 500).json({ message: msg, code });
    }
  });

// ─── Scheduled: Check Trial Expiry (daily 00:01 Asia/Dhaka) ─────────────

export const checkTrialExpiry = functions
  .region('asia-south1')
  .pubsub.schedule('1 0 * * *')
  .timeZone('Asia/Dhaka')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collection('tenants')
      .where('subscriptionStatus', '==', 'trial')
      .where('isActive', '==', true)
      .where('trialEndsAt', '<', now)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, {
        subscriptionStatus: 'expired',
        isActive: false,
        updatedAt: now,
      });

      // Audit log
      const auditRef = doc.ref.collection('audit_logs').doc();
      batch.set(auditRef, {
        id: auditRef.id,
        tenantId: doc.id,
        userId: 'system',
        userEmail: 'system',
        action: 'tenant.trial_expired',
        resourceType: 'tenant',
        resourceId: doc.id,
        changes: { subscriptionStatus: 'expired', isActive: false },
        ipAddress: '',
        userAgent: 'cloud-scheduler',
        createdAt: now,
      });

      // Update custom claims
      try {
        await auth.setCustomUserClaims(doc.id, {
          tenantId: doc.id,
          role: 'tenant_admin',
          isActive: false,
          isTrial: true,
        });
      } catch { /* user may have been deleted */ }
    }

    await batch.commit();
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[checkTrialExpiry] Expired ${snapshot.size} trial tenant(s)`);
    }
  });

// ─── Firestore Trigger: Tenant Activated → Update Custom Claims ──────────

export const onTenantActivated = functions
  .region('asia-south1')
  .firestore.document('tenants/{tenantId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { tenantId } = context.params;

    // Only react to subscriptionStatus changes to 'active'
    if (before.subscriptionStatus === after.subscriptionStatus) return;
    if (after.subscriptionStatus !== 'active') return;

    try {
      await auth.setCustomUserClaims(tenantId, {
        tenantId,
        role: 'tenant_admin',
        isActive: true,
        isTrial: false,
      });

      const now = admin.firestore.Timestamp.now();
      await change.after.ref
        .collection('audit_logs').doc()
        .set({
          tenantId,
          userId: after.activatedBy ?? 'system',
          userEmail: 'super_admin',
          action: 'tenant.activated',
          resourceType: 'tenant',
          resourceId: tenantId,
          changes: {
            subscriptionStatus: 'active',
            planId: after.planId,
          },
          ipAddress: '',
          userAgent: 'cloud-function',
          createdAt: now,
        });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[onTenantActivated]', err);
      }
    }
  });
