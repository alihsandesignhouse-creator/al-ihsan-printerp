/**
 * scripts/backfill-default-branches.js
 *
 * এক-বার-চালানোর, LOCAL-ONLY স্ক্রিপ্ট — "শূন্য-শাখা / একক-মালিক" বাগ
 * (১৫ আগস্ট ২০২৬ সেশন) ফিক্সের আগে সাইনআপ করা টেন্যান্টদের জন্য backfill।
 *
 * প্রেক্ষাপট: app/api/auth/signup ও app/api/super-admin/create-tenant
 * routes আগে কোনো ডিফল্ট branches/{branchId} ডকুমেন্ট তৈরি করত না। যেসব
 * টেন্যান্ট এই বাগ ঠিক হওয়ার আগে সাইনআপ করেছেন এবং যাদের কোনো শাখা নেই
 * (একক-মালিক, কোনো branch নিজে তৈরি করেননি), তারা এখনো অর্ডার/কোটেশন/
 * কস্টিং তৈরি করতে পারছেন না — কারণ এই ফিচারগুলোর জন্য অন্তত একটা branchId
 * দরকার।
 *
 * settings > শাখা ট্যাব এখন সব প্ল্যানের জন্য খোলা (আগে শুধু multiBranch
 * ফিচারের পেছনে লক ছিল), তাই আক্রান্ত টেন্যান্টরা চাইলে নিজেই সেখান থেকে
 * প্রথম শাখা তৈরি করে সমস্যা সমাধান করতে পারেন — এই স্ক্রিপ্টটা বাধ্যতামূলক
 * নয়, কিন্তু যদি আপনি (OMOR) না চান যে বিদ্যমান গ্রাহকরা নিজে থেকে এটা খুঁজে
 * বের করুন, তাহলে এই স্ক্রিপ্ট একবার চালিয়ে সবার জন্য স্বয়ংক্রিয়ভাবে
 * ব্যাকফিল করে দিতে পারেন।
 *
 * এই স্ক্রিপ্ট কী করে:
 *   1. /tenants কালেকশনের সব ডকুমেন্ট স্ক্যান করে
 *   2. প্রতিটা টেন্যান্টের /branches সাব-কালেকশন খালি কিনা চেক করে
 *   3. খালি হলে — signup route-এর সাথে হুবহু মিলিয়ে — একটা "প্রধান শাখা"
 *      ডকুমেন্ট তৈরি করে (নাম, address: "", phone: null,
 *      branchManagerId: null, isActive: true)
 *   4. প্রতিটা টেন্যান্টের জন্য কী করা হলো তার একটা সারাংশ প্রিন্ট করে
 *
 * ডিফল্টভাবে এটা DRY-RUN মোডে চলে — কিছুই Firestore-এ লেখে না, শুধু কোন
 * কোন টেন্যান্ট আক্রান্ত সেটা দেখায়। আসলেই ব্যাকফিল করতে --apply ফ্ল্যাগ
 * দিতে হবে।
 *
 * এটা deploy করা অ্যাপের অংশ না — আপনি নিজে, নিজের কম্পিউটার থেকে, নিজের
 * Firebase service account key দিয়ে একবার চালাবেন। Vercel/Netlify-তে
 * আপলোড হয় না।
 *
 * ব্যবহার:
 *   1. npm install firebase-admin --save-dev  (যদি আগে না করে থাকেন)
 *   2. serviceAccountKey.json প্রজেক্টের রুটে থাকা আবশ্যক (দেখুন
 *      scripts/set-super-admin.js-এর একই instruction)
 *   3. প্রথমে dry-run দিয়ে দেখুন কতজন আক্রান্ত:
 *        node scripts/backfill-default-branches.js
 *   4. নিশ্চিত হলে আসল ব্যাকফিল চালান:
 *        node scripts/backfill-default-branches.js --apply
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const APPLY = process.argv.includes("--apply");

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

const db = admin.firestore();

async function main() {
  console.log(APPLY ? "\n=== ব্যাকফিল চালু (--apply মোড, আসলেই Firestore-এ লেখা হবে) ===\n" : "\n=== DRY-RUN মোড — কিছুই লেখা হবে না, শুধু দেখানো হচ্ছে ===\n");

  const tenantsSnap = await db.collection("tenants").get();
  console.log(`মোট টেন্যান্ট: ${tenantsSnap.size}\n`);

  let affectedCount = 0;
  let fixedCount = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const tenant = tenantDoc.data();

    const branchesSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("branches")
      .limit(1)
      .get();

    if (!branchesSnap.empty) continue; // ইতিমধ্যে অন্তত একটা শাখা আছে — বাদ

    affectedCount += 1;
    const label = `${tenant.name ?? "(নাম নেই)"} — ${tenant.email ?? tenantId} (${tenantId})`;

    if (!APPLY) {
      console.log(`[আক্রান্ত] ${label}`);
      continue;
    }

    const now = admin.firestore.Timestamp.now();
    const branchRef = db.collection("tenants").doc(tenantId).collection("branches").doc();
    await branchRef.set({
      id: branchRef.id,
      tenantId,
      name: "প্রধান শাখা",
      address: tenant.address ?? "",
      phone: null,
      branchManagerId: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    fixedCount += 1;
    console.log(`[ঠিক করা হলো] ${label} → branchId: ${branchRef.id}`);
  }

  console.log(`\nমোট আক্রান্ত টেন্যান্ট (কোনো শাখা নেই): ${affectedCount}`);
  if (APPLY) {
    console.log(`মোট ঠিক করা হয়েছে: ${fixedCount}`);
  } else if (affectedCount > 0) {
    console.log("\nআসলেই ঠিক করতে: node scripts/backfill-default-branches.js --apply\n");
  } else {
    console.log("\nকোনো টেন্যান্ট আক্রান্ত নয় — ব্যাকফিলের দরকার নেই।\n");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\nত্রুটি ঘটেছে:", err.message || err);
  process.exit(1);
});
