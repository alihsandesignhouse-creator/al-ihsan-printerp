import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";

/**
 * NOTE: This file mirrors the Module 1 (Project Setup) configuration.
 * It is included here unchanged so this module is self-contained.
 * Do not duplicate this initialization elsewhere in the app.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * BUILD-001 ফিক্স (১৬ আগস্ট ২০২৬, external audit): এই মডিউলটা import
 * হওয়ার সাথে সাথেই (module-level side effect) `initializeFirestore()`
 * চালায় — অর্থাৎ `next build`-এর prerender ধাপেই এই ফাইলটা indirectly
 * import করা প্রতিটা পেজের জন্য এটা রান হয়। প্রয়োজনীয় env var অনুপস্থিত
 * থাকলে আগে Firebase SDK-র গভীর থেকে একটা দুর্বোধ্য
 * `auth/invalid-api-key` এরর আসত, প্রতিটা প্রভাবিত পেজে বার বার — যেটা
 * থেকে আসল কারণ (env var মিসিং) বোঝা কঠিন ছিল।
 *
 * এই architecture-এর মূল সীমাবদ্ধতা (client-side Firebase init, ব্লুপ্রিন্ট
 * section 2.1/5.1-এর প্রয়োজনীয়তা) সম্পূর্ণ বদলানো এই সেশনের স্কোপের বাইরে
 * (সব dashboard পেজকে force-dynamic করা একটা বড়, ঝুঁকিপূর্ণ refactor,
 * production-এর মতো পরিবেশে টেস্ট ছাড়া করা ঠিক না) — বাস্তবে Netlify-তে
 * env var সবসময় সেট থাকে বলে এটা কখনো প্রকৃতপক্ষে ঘটে না। কিন্তু অন্তত
 * এরর মেসেজটা এখন স্পষ্ট ও কার্যকরী: ঠিক কোন env var(s) অনুপস্থিত তা
 * নাম ধরে বলে দেয়, এবং Firebase SDK-র গভীরে যাওয়ার আগেই থামে।
 */
function assertFirebaseConfigured(): void {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `[AL-IHSAN PrintERP] Firebase কনফিগারেশন অসম্পূর্ণ — নিচের environment variable(s) সেট করা নেই: ${missing
        .map((k) => `NEXT_PUBLIC_FIREBASE_${k.replace(/([A-Z])/g, "_$1").toUpperCase()}`)
        .join(", ")}। ` +
        "Netlify/Firebase Console থেকে এই মানগুলো .env.local (লোকাল) অথবা Netlify Site settings → " +
        "Environment variables (ডিপ্লয়মেন্ট)-এ যোগ করুন, তারপর আবার build/dev চালান।"
    );
  }
}

assertFirebaseConfigured();

function createFirebaseApp(): FirebaseApp {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }
  return initializeApp(firebaseConfig);
}

export const app: FirebaseApp = createFirebaseApp();

/**
 * Firestore with offline persistence enabled from day one.
 * Required by blueprint section 5.1 — never replace with getFirestore().
 */
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth: Auth = getAuth(app);
export const functions: Functions = getFunctions(app, "asia-south1");

/**
 * Firebase Emulator Suite wiring — LOCAL TESTING ONLY.
 *
 * Set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true in .env.local to point every
 * client SDK (Auth, Firestore, Functions) at `firebase emulators:start`
 * running on localhost instead of production Firebase. This is what makes it
 * possible to test the full signup → tenant-creation → login flow entirely
 * on localhost, with zero deployment and zero Blaze billing, before a
 * GitHub repo or production Firebase project exists.
 *
 * NOTE (Phase F1 #8): Storage emulator wiring was removed here — logo
 * upload no longer goes through the Firebase Storage SDK on this
 * (free-edition) branch. See lib/firebase/tenant-settings.ts.
 *
 * Guarded by a module-level flag (not just NODE_ENV) so a developer can run
 * `npm run dev` against a *real* Firebase project too, for testing against
 * production data, without editing this file.
 */
declare global {
  // eslint-disable-next-line no-var
  var __printerpEmulatorsConnected: boolean | undefined;
}

if (
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" &&
  typeof window !== "undefined" &&
  !globalThis.__printerpEmulatorsConnected
) {
  globalThis.__printerpEmulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  // eslint-disable-next-line no-console
  console.info("[AL-IHSAN PrintERP] Firebase Emulator Suite-এ সংযুক্ত (localhost, production নয়)");
}
