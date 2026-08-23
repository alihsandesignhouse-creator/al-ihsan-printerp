/**
 * scripts/set-super-admin.js
 *
 * One-time, LOCAL-ONLY script to promote an existing Firebase Auth user to
 * SUPER_ADMIN. This sets the custom claims that firestore.rules and
 * middleware.ts both check (request.auth.token.role === 'super_admin').
 *
 * This is NOT part of the deployed app — you run it once, yourself, from
 * your own computer, using a Firebase service account key. It is not
 * uploaded to Vercel or anywhere else.
 *
 * USAGE:
 *   1. npm install firebase-admin --save-dev
 *   2. Download your service account key (see README instructions below)
 *      and save it as serviceAccountKey.json in the project root.
 *   3. node scripts/set-super-admin.js owner@example.com
 *
 * After running, the user must log out and log back in (or refresh their
 * ID token) for the new claims to take effect, since Firebase only embeds
 * custom claims into the ID token at sign-in / token refresh time.
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const email = process.argv[2];

if (!email) {
  console.error("\nব্যবহার: node scripts/set-super-admin.js <email>\n");
  console.error("উদাহরণ: node scripts/set-super-admin.js owner@example.com\n");
  process.exit(1);
}

const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");

if (!fs.existsSync(keyPath)) {
  console.error(
    `\nserviceAccountKey.json পাওয়া যায়নি: ${keyPath}\n` +
      "Firebase Console > Project Settings > Service accounts > Generate new private key\n" +
      "থেকে ডাউনলোড করে এই নামে প্রজেক্টের রুটে রাখুন।\n"
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

async function main() {
  const auth = admin.auth();

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`\nএই Email দিয়ে কোনো Firebase Auth ইউজার পাওয়া যায়নি: ${email}\n`);
    process.exit(1);
  }

  // These are exactly the claims firestore.rules and middleware.ts expect
  // (see lib/types/auth.ts -> AuthClaims). tenantId is null for super_admin
  // since they aren't scoped to any single tenant.
  const claims = {
    role: "super_admin",
    isActive: true,
    isTrial: false,
    tenantId: null,
  };

  await auth.setCustomUserClaims(user.uid, claims);

  // Optional but recommended: keep a matching record in Firestore so the
  // super-admin panel can list/manage admin accounts later (blueprint
  // section 12.1, /super_admins/{adminId}).
  await admin.firestore().collection("super_admins").doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`\n✓ সফল হয়েছে: ${email} (uid: ${user.uid}) এখন SUPER_ADMIN।`);
  console.log("→ এই ইউজারকে অ্যাপে লগইন করা থাকলে লগআউট করে আবার লগইন করতে বলুন,");
  console.log("  তাহলেই নতুন claims কার্যকর হবে।\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nত্রুটি ঘটেছে:", err.message || err);
  process.exit(1);
});
