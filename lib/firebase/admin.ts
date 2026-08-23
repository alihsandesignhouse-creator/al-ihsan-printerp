import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * lib/firebase/admin.ts — server-only Firebase Admin SDK singleton.
 *
 * Free Edition context: Firebase Spark plan cannot deploy Cloud Functions,
 * so the business logic that used to live in `functions/src/*.ts` (Admin
 * SDK calls: creating Auth users, writing Firestore documents with elevated
 * privileges, setting custom claims) now runs directly inside Next.js API
 * routes under `app/api/*`. Those routes import this module instead of
 * talking to a deployed Cloud Function over HTTP.
 *
 * This file must NEVER be imported from a "use client" component or any
 * module that ends up in the browser bundle — it uses `firebase-admin`,
 * which requires a Node.js runtime and (in production) private service
 * account credentials. `next.config.js` already lists `firebase-admin` in
 * `experimental.serverComponentsExternalPackages` for this reason.
 *
 * ── Local emulator testing ──────────────────────────────────────────────
 * When `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` (see SETUP-TESTING.md), the
 * Admin SDK is pointed at the local Auth/Firestore emulators started by
 * `firebase emulators:start` (ports match firebase.json) using the standard
 * `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` env vars that
 * firebase-admin recognizes automatically. No real service account
 * credentials are needed in this mode — only a project ID namespace.
 *
 * ── Production (Netlify) ────────────────────────────────────────────────
 * Three environment variables must be set in Netlify's Environment
 * Variables UI (never committed to git):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY   (paste with literal \n escapes — this file
 *                                 converts them back to real newlines)
 * These come from Firebase Console → Project Settings → Service accounts →
 * Generate new private key. Three separate variables are used instead of
 * one JSON blob because most hosting UIs (Netlify included) mangle
 * multi-line JSON values in a single env var; three flat strings avoid that.
 */

let cachedApp: App | null = null;

function isEmulatorMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
}

function initAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0 && existing[0]) {
    return existing[0];
  }

  const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (isEmulatorMode()) {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    }
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    }
    return initializeApp({ projectId: publicProjectId });
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const adminProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? publicProjectId;

  if (!clientEmail || !privateKeyRaw || !adminProjectId) {
    throw new Error(
      "Firebase Admin credentials configured নয়। FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL এবং FIREBASE_ADMIN_PRIVATE_KEY environment " +
        "variable সেট করুন (অথবা লোকাল টেস্টিং-এর জন্য NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true করুন)।"
    );
  }

  return initializeApp({
    credential: cert({
      projectId: adminProjectId,
      clientEmail,
      // Netlify/most env-var UIs store newlines as the two-character
      // sequence "\n" — convert back to real newlines for the PEM key.
      privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
    }),
  });
}

/** Lazily creates (once) and returns the singleton Admin app. */
export function getAdminApp(): App {
  if (!cachedApp) {
    cachedApp = initAdminApp();
  }
  return cachedApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
