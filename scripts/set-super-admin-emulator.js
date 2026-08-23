/**
 * scripts/set-super-admin-emulator.js
 *
 * EMULATOR-ONLY equivalent of scripts/set-super-admin.js. Use this while
 * testing locally against `firebase emulators:start` — it does NOT need a
 * serviceAccountKey.json, because the Auth/Firestore emulators do not check
 * credentials at all (they trust any Admin SDK connection that points at
 * them via the *_EMULATOR_HOST environment variables set below).
 *
 * Never point this script at a real project — it is intentionally
 * credential-free, which would be unsafe against production Firebase.
 *
 * PREREQUISITES:
 *   1. `firebase emulators:start` must already be running in another
 *      terminal (see SETUP-TESTING.md).
 *   2. The user must already exist in the Auth emulator — i.e. you must
 *      have signed up or logged in at least once through the app's UI
 *      with this email first (Module T-01 self-signup, or create the user
 *      directly from the Emulator UI at http://127.0.0.1:4000/auth).
 *
 * USAGE:
 *   node scripts/set-super-admin-emulator.js owner@example.com
 *
 * After running, log out and log back in in the browser so the ID token
 * picks up the new custom claims.
 */

const admin = require("firebase-admin");

const email = process.argv[2];

if (!email) {
  console.error("\nব্যবহার: node scripts/set-super-admin-emulator.js <email>\n");
  console.error("উদাহরণ: node scripts/set-super-admin-emulator.js owner@example.com\n");
  process.exit(1);
}

// Point the Admin SDK at the local emulators instead of production Firebase.
// Must be set BEFORE admin.initializeApp() / any admin.auth() calls.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "printerp-local-demo";

admin.initializeApp({ projectId });

async function main() {
  const auth = admin.auth();

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(
      `\nএই Email দিয়ে Auth Emulator-এ কোনো ইউজার পাওয়া যায়নি: ${email}\n` +
        "আগে অ্যাপে গিয়ে এই Email দিয়ে একবার সাইন আপ/লগইন করুন, তারপর এই স্ক্রিপ্ট আবার চালান।\n" +
        "অথবা সরাসরি Emulator UI থেকে ইউজার তৈরি করুন: http://127.0.0.1:4000/auth\n"
    );
    process.exit(1);
  }

  const claims = {
    role: "super_admin",
    isActive: true,
    isTrial: false,
    tenantId: null,
  };

  await auth.setCustomUserClaims(user.uid, claims);

  await admin.firestore().collection("super_admins").doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`\n✓ সফল হয়েছে (Emulator): ${email} (uid: ${user.uid}) এখন SUPER_ADMIN।`);
  console.log("→ ব্রাউজারে লগআউট করে আবার লগইন করুন, তাহলেই নতুন claims কার্যকর হবে।\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nত্রুটি ঘটেছে:", err.message || err);
  process.exit(1);
});
