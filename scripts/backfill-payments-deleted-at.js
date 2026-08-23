/**
 * scripts/backfill-payments-deleted-at.js
 *
 * এক-বার-চালানোর, LOCAL-ONLY স্ক্রিপ্ট — ইউজার-ফিডব্যাক সেশন ২ (অর্ডার
 * ডিলিট → পেমেন্ট ক্যাসকেড, ১৮ আগস্ট ২০২৬) ফিচারের আগে রেকর্ড হওয়া সব
 * payment ডকুমেন্টে deletedAt: null, deletedBy: null ব্যাকফিল করে।
 *
 * প্রেক্ষাপট: এখন softDeleteOrder() একটা অর্ডার সফট-ডিলিট করলে সংশ্লিষ্ট
 * সব payment ডকুমেন্টেও deletedAt/deletedBy সেট করে দেয়, এবং পেমেন্ট
 * পড়া হয় এমন সব জায়গায় (payments লিস্ট পেজ, ড্যাশবোর্ড KPI, রিপোর্ট,
 * কাস্টমার প্রোফাইল, যাকাত) এখন where("deletedAt","==",null) ফিল্টার
 * ব্যবহার করে। Firestore-এ এই কুয়েরি এমন ডকুমেন্ট বাদ দেয় যাদের ফিল্ডটা
 * আদৌ নেই (undefined !== null) — তাই এই ফিচারের আগে রেকর্ড হওয়া সব
 * পুরনো payment ডকুমেন্ট (যাদের deletedAt ফিল্ডই নেই) হঠাৎ সব জায়গা
 * থেকে অদৃশ্য হয়ে যাবে, যদিও আসলে সেগুলো ডিলিট হয়নি। এই স্ক্রিপ্ট সেই
 * সমস্যা প্রতিরোধ করে।
 *
 * scripts/backfill-default-branches.js-এর কনভেনশন অনুসরণ করে:
 *   1. /tenants কালেকশনের সব টেন্যান্ট স্ক্যান করে
 *   2. প্রতিটা টেন্যান্টের /payments সাব-কালেকশনের সব ডকুমেন্ট চেক করে
 *   3. যাদের deletedAt ফিল্ড নেই (undefined), তাদের deletedAt: null,
 *      deletedBy: null সেট করে দেয় (ব্যাচ রাইট, প্রতি ৪০০ ডকুমেন্টে একবার commit)
 *   4. যাদের ইতিমধ্যে deletedAt ফিল্ড আছে (এই সেশনের পরে রেকর্ড হওয়া নতুন
 *      পেমেন্ট, অথবা আগে একবার এই স্ক্রিপ্ট চালানো হয়েছে) — স্কিপ করে
 *
 * ডিফল্টভাবে DRY-RUN মোড — কিছুই Firestore-এ লেখে না। আসলেই ব্যাকফিল
 * করতে --apply ফ্ল্যাগ দিতে হবে।
 *
 * এটা deploy করা অ্যাপের অংশ না — আপনি নিজে, নিজের কম্পিউটার থেকে, নিজের
 * Firebase service account key দিয়ে একবার চালাবেন।
 *
 * ব্যবহার:
 *   1. npm install firebase-admin --save-dev  (যদি আগে না করে থাকেন)
 *   2. serviceAccountKey.json প্রজেক্টের রুটে থাকা আবশ্যক
 *   3. প্রথমে dry-run:
 *        node scripts/backfill-payments-deleted-at.js
 *   4. নিশ্চিত হলে আসল ব্যাকফিল:
 *        node scripts/backfill-payments-deleted-at.js --apply
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 400; // Firestore ব্যাচ লিমিট ৫০০, নিরাপদ মার্জিন রাখা হলো

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
  console.log(
    APPLY
      ? "\n=== ব্যাকফিল চালু (--apply মোড, আসলেই Firestore-এ লেখা হবে) ===\n"
      : "\n=== DRY-RUN মোড — কিছুই লেখা হবে না, শুধু দেখানো হচ্ছে ===\n"
  );

  const tenantsSnap = await db.collection("tenants").get();
  console.log(`মোট টেন্যান্ট: ${tenantsSnap.size}\n`);

  let totalAffectedTenants = 0;
  let totalAffectedPayments = 0;
  let totalFixedPayments = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const tenant = tenantDoc.data();
    const label = `${tenant.name ?? "(নাম নেই)"} — ${tenant.email ?? tenantId} (${tenantId})`;

    const paymentsSnap = await db.collection("tenants").doc(tenantId).collection("payments").get();

    const missingDocs = paymentsSnap.docs.filter((d) => !("deletedAt" in d.data()));

    if (missingDocs.length === 0) continue;

    totalAffectedTenants += 1;
    totalAffectedPayments += missingDocs.length;
    console.log(`[আক্রান্ত] ${label} — ${missingDocs.length} টি পেমেন্ট ডকুমেন্টে deletedAt ফিল্ড নেই`);

    if (!APPLY) continue;

    for (let i = 0; i < missingDocs.length; i += BATCH_SIZE) {
      const chunk = missingDocs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const paymentDoc of chunk) {
        batch.update(paymentDoc.ref, { deletedAt: null, deletedBy: null });
      }
      await batch.commit();
      totalFixedPayments += chunk.length;
    }
    console.log(`  → ঠিক করা হলো: ${missingDocs.length} টি ডকুমেন্ট`);
  }

  console.log(`\nমোট আক্রান্ত টেন্যান্ট: ${totalAffectedTenants}`);
  console.log(`মোট আক্রান্ত পেমেন্ট ডকুমেন্ট: ${totalAffectedPayments}`);
  if (APPLY) {
    console.log(`মোট ঠিক করা হয়েছে: ${totalFixedPayments}`);
  } else if (totalAffectedPayments > 0) {
    console.log("\nআসলেই ঠিক করতে: node scripts/backfill-payments-deleted-at.js --apply\n");
  } else {
    console.log("\nকোনো পেমেন্ট ডকুমেন্ট আক্রান্ত নয় — ব্যাকফিলের দরকার নেই।\n");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\nত্রুটি ঘটেছে:", err.message || err);
  process.exit(1);
});
