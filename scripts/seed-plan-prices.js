/**
 * scripts/seed-plan-prices.js
 *
 * One-time, LOCAL-ONLY script to set the launch prices (সেশন ৪, ১৮ আগস্ট
 * ২০২৬) on the three subscription_plans/{basic,standard,premium} docs.
 *
 * কেন এই script দরকার: DEFAULT_PLAN_CATALOG (lib/types/subscription-plan.ts)-
 * এর মূল্য শুধু তখনই ব্যবহার হয় যখন কোনো plan doc Firestore-এ এখনো তৈরিই
 * হয়নি (withFeaturesFallback() দেখুন)। যদি Super Admin আগে কখনো Packages
 * পেজ থেকে EditPlanModal দিয়ে একবারও সেভ করে থাকেন, তাহলে Firestore-এ
 * আগের (placeholder) দামই থেকে যাবে — কোড পরিবর্তন সেটা ওভাররাইট করবে না।
 * তাই লাইভ ডেটাবেসের দামও এই script দিয়ে সরাসরি আপডেট করা হচ্ছে।
 *
 * merge:true ব্যবহার করা হচ্ছে — শুধু monthlyPrice/yearlyPrice বদলাবে,
 * maxStaff/maxBranches/featuresBn/featuresEn/features (feature toggles)
 * কোনোটাই স্পর্শ করা হবে না (Super Admin আগে যা সেট করেছেন তা অক্ষত থাকবে)।
 *
 * USAGE:
 *   1. npm install firebase-admin --save-dev  (যদি আগে থেকে না থাকে)
 *   2. serviceAccountKey.json প্রজেক্ট রুটে থাকা আবশ্যক (set-super-admin.js
 *      স্ক্রিপ্টের মতোই — Firebase Console > Project Settings > Service
 *      accounts > Generate new private key)
 *   3. node scripts/seed-plan-prices.js
 *
 * নিরাপদ — dry-run নেই কারণ এটা শুধু ২টা numeric ফিল্ড merge করে, কোনো
 * ডকুমেন্ট মুছে না, কোনো ডেটা হারানোর ঝুঁকি নেই।
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");

if (!fs.existsSync(keyPath)) {
  console.error(
    `\nserviceAccountKey.json পাওয়া যায়নি: ${keyPath}\n` +
      "Firebase Console > Project Settings > Service accounts > Generate new private key\n"
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

const db = admin.firestore();

// সেশন ৪-এ Owner-নির্ধারিত চূড়ান্ত মূল্য (৳৳):
const PRICES = {
  basic: { monthlyPrice: 300, yearlyPrice: 3000 },
  standard: { monthlyPrice: 500, yearlyPrice: 5000 },
  premium: { monthlyPrice: 700, yearlyPrice: 7000 },
};

async function main() {
  for (const [planId, price] of Object.entries(PRICES)) {
    await db.collection("subscription_plans").doc(planId).set(
      {
        id: planId,
        monthlyPrice: price.monthlyPrice,
        yearlyPrice: price.yearlyPrice,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByAdminId: "seed-script",
      },
      { merge: true }
    );
    console.log(
      `✓ ${planId}: ৳${price.monthlyPrice}/মাস, ৳${price.yearlyPrice}/বছর সেট হলো।`
    );
  }

  console.log("\n✓ সব প্যাকেজের দাম আপডেট সম্পন্ন।");
  console.log(
    "→ Packages পেজ রিফ্রেশ করে (বা /trial-expired পেজে গিয়ে) নতুন দাম দেখে নিন।\n"
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("\nত্রুটি ঘটেছে:", err.message || err);
  process.exit(1);
});
