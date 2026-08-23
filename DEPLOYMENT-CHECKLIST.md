# AL-IHSAN PrintERP — Free Edition Deployment Checklist
### Phase F2 #11 (Netlify প্রজেক্ট সেটআপ ও Environment Variables)

> এই ফাইলে **কোনো আসল secret value নেই** — শুধু variable-এর নাম, উৎস, এবং কোন
> ফাইল সেটা ব্যবহার করে তার তালিকা। আসল মান শুধু Netlify UI-এর Environment
> Variables পেজে বসবে, কখনো git-এ কমিট হবে না।

---

## ✅ Go-Live ব্লকার সমাধান হয়েছে (Phase F1 #8, এই সেশনে)

আগের সেশনে (Phase F2 #11) এখানে একটা **critical wiring gap** নথিভুক্ত ছিল:
Phase F1 #8 (Cloudinary/Supabase Storage migration) কখনো সম্পন্ন হয়নি,
ফলে `uploadTenantLogo()` তখনো Firebase Cloud Storage ব্যবহার করত, যা Spark
প্ল্যানে প্রোডাকশনে কাজ করত না।

**এই সেশনে সমাধান করা হয়েছে:**
- `lib/firebase/tenant-settings.ts`-এর `uploadTenantLogo()` এখন Cloudinary-র
  unsigned upload preset ব্যবহার করে (`fetch()` দিয়ে সরাসরি ব্রাউজার থেকে,
  কোনো SDK/backend signed request ছাড়াই)
- `lib/firebase/client.ts` থেকে Firebase Storage SDK (`getStorage`,
  `connectStorageEmulator`, `storage` export) সরানো হয়েছে
- নতুন env var: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`,
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (নিচের ১.৪ সেকশনে বিস্তারিত)
- `next.config.js`-এর `images.domains`-এ `firebasestorage.googleapis.com`-এর
  বদলে `res.cloudinary.com` বসানো হয়েছে

**যা পরিবর্তন হয়নি (ইচ্ছাকৃতভাবে):**
- `storage.rules` ও `firebase.json`-এর `storage` সেকশন — মোছা হয়নি, কারণ
  `main` ব্রাঞ্চে (Vercel/Main Edition, Blaze প্ল্যান) এখনো আসল Firebase
  Storage ব্যবহৃত হয় (`functions/`-এর মতোই একই নীতি — শুধু free-edition
  branch-এর দৃষ্টিকোণ থেকে এগুলো এখন obsolete)
- delivery challan/quotation/portal invoice-এর logo `<img>` রেন্ডারিং —
  এগুলো শুধু `logoUrl` স্ট্রিং রেন্ডার করে, উৎস কোথা থেকে এসেছে সেটা নিয়ে
  মাথা ঘামায় না, তাই কোনো পরিবর্তন লাগেনি

**গুরুত্বপূর্ণ ট্রেড-অফ (নিচে ৩ নং সেকশনেও বিস্তারিত):** unsigned Cloudinary
preset-এ `storage.rules`-এর মতো server-enforced role/tenantId চেক বা
হার্ড ফাইল-সাইজ গ্যারান্টি নেই — শুধু client-side ভ্যালিডেশন
(`general-settings-form.tsx`) + Cloudinary preset-level সীমা (courtesy,
বাইপাসযোগ্য)। Free Edition-এর card-free/backend-free ভিত্তির জন্য এটা একটা
সচেতনভাবে গৃহীত ট্রেড-অফ।

---

## ১. Environment Variables — সম্পূর্ণ তালিকা

কোডে `grep -rn "process\.env\."` চালিয়ে যাচাই করা হয়েছে (app/, lib/, netlify/,
middleware.ts, next.config.js) — নিচের তালিকাটাই সম্পূর্ণ, কোনো var মিসিং নয়।

### ১.১ Public (client-side, `NEXT_PUBLIC_` প্রিফিক্স — ব্রাউজারে expose হয়)

| Variable | উৎস | ব্যবহৃত ফাইল |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → General → Web app config | `lib/firebase/client.ts` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ঐ | `lib/firebase/client.ts` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ঐ | `lib/firebase/client.ts`, `lib/firebase/admin.ts` (emulator fallback প্রজেক্ট আইডি হিসেবে) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ঐ | `lib/firebase/client.ts` (শুধু `firebaseConfig` অবজেক্টের অংশ হিসেবে রাখা হয়েছে — Storage SDK আর ব্যবহৃত হয় না, তাই এই var-এর মান কার্যত ব্যবহৃত হয় না, harmless) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ঐ | `lib/firebase/client.ts` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ঐ | `lib/firebase/client.ts` |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | ম্যানুয়াল — প্রোডাকশনে **সেট করবেন না** (বা `false`) | `lib/firebase/client.ts`, `lib/firebase/admin.ts` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary Console → Dashboard ("Cloud name") | `lib/firebase/tenant-settings.ts` |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary Console → Settings → Upload → Upload presets (Signing Mode: Unsigned) | `lib/firebase/tenant-settings.ts` |

### ১.২ Server-only (Netlify Function/API route runtime, ব্রাউজারে expose হয় না)

| Variable | উৎস | ব্যবহৃত ফাইল |
|---|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Console → Project Settings → Service accounts → Generate new private key (JSON-এর `project_id`) | `lib/firebase/admin.ts` (সব `app/api/*` রুট ও সব `netlify/functions/*.mts` এটা import করে) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | ঐ JSON-এর `client_email` | ঐ |
| `FIREBASE_ADMIN_PRIVATE_KEY` | ঐ JSON-এর `private_key` — **পুরো মাল্টি-লাইন PEM স্ট্রিং, `\n` literal escape সহ pasted** (Netlify UI মাল্টি-লাইন মান মাঝেমধ্যে ভেঙে ফেলে, তাই `lib/firebase/admin.ts` নিজে `\n` কে real newline-এ রূপান্তর করে) | ঐ |

### ১.৩ স্বয়ংক্রিয়ভাবে সেট হয় (কিছু করার দরকার নেই)

| Variable | মন্তব্য |
|---|---|
| `NODE_ENV` | Next.js/Netlify build সিস্টেম নিজে থেকেই সেট করে (`production` build/deploy-এ, `development` local dev-এ) — Netlify UI-তে ম্যানুয়ালি সেট করার দরকার নেই |
| `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` | শুধু লোকাল emulator টেস্টিং-এর জন্য (`lib/firebase/admin.ts`/`client.ts` নিজে থেকেই ডিফল্ট বসায় যখন `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`) — Netlify production-এ সেট করবেন **না** |

### ১.৪ Storage — Cloudinary migration সম্পন্ন (Phase F1 #8)

Logo upload এখন Cloudinary unsigned upload preset ব্যবহার করে (Firebase
Storage আর ব্যবহৃত হয় না)। Deploy করার আগে অবশ্যই লাগবে:

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — Cloudinary Console-এ preset
  তৈরির সময় **Signing Mode: Unsigned** সেট করতে ভুলবেন না, নাহলে upload
  ব্রাউজার থেকে ব্যর্থ হবে (401)। প্রস্তাবিত preset কনফিগারেশন:
  - Allowed formats: শুধু image ফরম্যাট (jpg, png, webp, gif)
  - Max file size: 2MB (client-side চেকের সাথে সামঞ্জস্যপূর্ণ, কিন্তু এটা
    courtesy-level — bypass করা সম্ভব, উপরের ট্রেড-অফ নোট দেখুন)

`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` সেট রাখলেও কোনো সমস্যা নেই (harmless
dead value, Storage SDK আর সেটা পড়ে না)।

---

## ২. Firebase Auth — Authorized Domains (Phase F1 #9)

Firebase Console → Authentication → Settings → Authorized domains-এ নিচের
ডোমেইন প্যাটার্নগুলো যোগ করতে হবে (নাহলে Auth SDK ব্রাউজারে `auth/unauthorized-
domain` error দেবে):

- [ ] প্রতিটা Netlify **Deploy Preview** ও **branch deploy** URL আলাদা
      সাবডোমেইন হয় (যেমন `deploy-preview-12--yoursite.netlify.app`) — Firebase
      Console wildcard সাপোর্ট করে না প্যাটার্ন হিসেবে, তাই প্রতিটা নির্দিষ্ট
      preview ডোমেইন আলাদা করে যোগ করতে হয় **অথবা** শুধু primary preview/
      production ডোমেইন ব্যবহার করে preview-তে auth টেস্ট এড়িয়ে যেতে হয় (ছোট
      টিমের জন্য বাস্তবসম্মত পন্থা — প্রতিটা PR preview-এর জন্য আলাদা domain
      যোগ করা টেকসই নয়)
- [ ] প্রাইমারি Netlify সাইট ডোমেইন: `yoursite.netlify.app` (Netlify site
      তৈরি হওয়ার পরে প্রকৃত নাম বসবে)
- [ ] কাস্টম ডোমেইন/সাবডোমেইন (যদি Phase F2 #13-এ কানেক্ট করা হয়): যেমন
      `app.printsaas.com.bd` বা যা চূড়ান্ত হয়
- [ ] `localhost` (emulator/লোকাল dev-এর জন্য — সাধারণত ডিফল্টেই থাকে)

---

## ৩. Netlify Build সেটিংস যাচাই

`netlify.toml`-এর সাথে কোডের সামঞ্জস্য এই সেশনে নিশ্চিত করা হয়েছে:

- [x] `[build] command = "npm run build"` ↔ `package.json`-এর
      `"build": "next build"` script-এর সাথে মেলে
- [x] `[build] publish = ".next"` ↔ `@netlify/plugin-nextjs` প্লাগইন এই
      directory থেকেই Next.js output ধরে নেয় (স্ট্যান্ডার্ড কনভেনশন)
- [x] `[build.environment] NODE_VERSION = "20"` ↔ `package.json`/`firebase.json`
      উভয় জায়গায় Node 20 ধরে নেওয়া হয়েছে (Cloud Functions runtime-ও
      `nodejs20`, যদিও `functions/` এখন free-edition-এ obsolete)
- [x] `[[plugins]] package = "@netlify/plugin-nextjs"` ↔ ইনস্টল করা লাগবে
      (`npm install -D @netlify/plugin-nextjs` — `package.json`-এ dependency
      হিসেবে থাকা আবশ্যক, যাচাই করুন `npm ls @netlify/plugin-nextjs`)

---

## ৪. Netlify Site তৈরির ধাপ (ম্যানুয়াল, Netlify UI-তে)

- [ ] Netlify Dashboard → "Add new site" → "Import an existing project" →
      GitHub রিপো সিলেক্ট করুন
- [ ] **Branch to deploy: `free-edition`** (এটা ভুল করে `main` সিলেক্ট করলে
      Vercel/Main Edition-এর জন্য লেখা কোড Netlify-তে deploy হওয়ার চেষ্টা
      করবে, যেখানে `functions/` ফোল্ডার সহ পুরো ভিন্ন backend assumption আছে)
- [ ] Build settings স্বয়ংক্রিয়ভাবে `netlify.toml` থেকে পড়বে — ম্যানুয়ালি
      override করার দরকার নেই
- [ ] Site তৈরির পরে সাথে সাথেই deploy না করে আগে "Environment variables"
      ট্যাবে গিয়ে উপরের ১.১ ও ১.২ সেকশনের সব variable বসিয়ে নিন, তারপর প্রথম
      deploy ট্রিগার করুন (নাহলে প্রথম build/render-এ Firebase init ব্যর্থ হবে)
- [ ] "Scopes" (কোন deploy context-এ কোন env var প্রযোজ্য) ডিফল্ট রাখুন — সব
      contexts (production, deploy previews, branch deploys) একই Firebase
      প্রজেক্টের সাথে কথা বলবে যেহেতু আলাদা staging Firebase প্রজেক্ট এখনো নেই

---

## ৫. প্রথম Deploy-এর পরে যাচাই করুন

- [ ] সাইট লোড হয় এবং `/login` পেজ crash করে না (Firebase client init সফল
      হয়েছে তার প্রমাণ)
- [ ] `/signup` দিয়ে একটা টেস্ট trial tenant তৈরি করে দেখুন (`app/api/auth/
      signup` রুট Admin SDK দিয়ে কাজ করছে কিনা)
- [ ] Super Admin দিয়ে লগইন করে `/super-admin` প্যানেলে ঢুকে একটা tenant
      Activate করে দেখুন (`app/api/super-admin/activate-tenant` রুট)
- [ ] একটা টেস্ট অর্ডার তৈরি করুন, কয়েক মিনিট অপেক্ষা করে দেখুন
      `orderNumber` "OFFLINE-..." থেকে "PP-2026-XXXX"-এ বদলেছে কিনা
      (Netlify UI → Functions → `generate-order-numbers` → "Run now" দিয়ে
      ম্যানুয়ালি ট্রিগার করে তাড়াতাড়ি টেস্ট করা যায়, ৩ মিনিট অপেক্ষা না করে)
- [ ] একই অর্ডারের notification bell-এ সঠিক final order number দেখাচ্ছে
      কিনা যাচাই করুন
- [ ] `/portal/{tenantId}/{orderId}` কাস্টমার পোর্টাল ট্র্যাকিং কাজ করছে
      কিনা যাচাই করুন
- [ ] Netlify UI → Functions ট্যাবে পাঁচটা scheduled function-ই "Scheduled"
      ব্যাজ সহ দেখা যাচ্ছে কিনা নিশ্চিত করুন: `check-trial-expiry`,
      `check-quotation-expiry`, `send-daily-notifications`,
      `generate-order-numbers`, `generate-quotation-numbers`
- [ ] লগ আউট করে আবার লগইন করে session persist হচ্ছে কিনা যাচাই করুন
- [ ] Tenant Settings → সাধারণ তথ্য ট্যাবে গিয়ে একটা লোগো (image/*, 2MB-এর
      কম) আপলোড করে দেখুন এটা **সফল** হচ্ছে কিনা (Phase F1 #8 সম্পন্ন হওয়ার
      পরে এখন এটা কাজ করার কথা — Cloudinary env var দুটো Netlify-তে সেট করা
      আছে কিনা আগে নিশ্চিত করুন)। বিস্তারিত টেস্ট কেস নিচের সেকশন ৬-এ।

---

## ৬. Phase F2 #12 — Preview URL-এ সম্পূর্ণ QA চেকলিস্ট

> Blueprint রেফারেন্স: `PrintERP_Free_Edition_Blueprint.md`, অংশ ৫ (Phase F2),
> আইটেম #১২। এই চেকলিস্ট উপরের সেকশন ৫ (প্রথম deploy-পরবর্তী স্মোক টেস্ট)-এর
> চেয়ে বিস্তারিত — প্রতিটা মূল ইউজার ফ্লো, অনলাইন ও অফলাইন উভয় সিনারিওতে।
> Netlify Preview URL (deploy preview বা branch deploy) ব্যবহার করে টেস্ট
> করুন, production নয়।

### ৬.১ Auth ও Trial ফ্লো
- [ ] `/signup`-এ নতুন প্রতিষ্ঠান রেজিস্টার করুন — Firestore-এ tenant doc
      তৈরি হয়েছে কিনা, `subscriptionStatus: 'trial'`, `trialEndsAt` = now + 3
      দিন কিনা যাচাই করুন
- [ ] Trial banner সব পেজে দেখা যাচ্ছে, বন্ধ করা যাচ্ছে না (non-dismissable)
      কিনা যাচাই করুন
- [ ] Super Admin দিয়ে লগইন করে নতুন trial tenant দেখা যাচ্ছে কিনা, তারপর
      Activate করে Package/মেয়াদ সেট করে দেখুন — Custom Claim আপডেট হয়ে
      `subscriptionStatus: 'active'` হচ্ছে কিনা (লগ আউট/লগইন করে claim
      refresh যাচাই করুন)
- [ ] ভুল পাসওয়ার্ড দিয়ে ৫ বার লগইন চেষ্টা করে ৩০ মিনিট lock হচ্ছে কিনা
      (Firebase App Check সেটআপ থাকলে)

### ৬.২ Order ও Delivery Challan ফ্লো (অনলাইন)
- [ ] নতুন অর্ডার তৈরি করুন — `branchId` সহ সেভ হচ্ছে কিনা, চূড়ান্ত বিল/বকেয়া
      হিসাব সঠিক কিনা (`Math.round(value * 100) / 100` রাউন্ডিং)
- [ ] অর্ডার তৈরির সাথে সাথেই (কয়েক সেকেন্ডের মধ্যে) in-app notification
      bell-এ দেখা যাচ্ছে কিনা (Direct-Call Pattern, `notifyOnNewOrder`)
- [ ] কয়েক মিনিট পরে `orderNumber` "OFFLINE-..." থেকে প্রকৃত সিকোয়েন্সিয়াল
      নম্বরে (`PP-2026-XXXX` বা tenant-এর prefix) বদলেছে কিনা যাচাই করুন
      (Netlify UI-তে `generate-order-numbers` "Run now" দিয়ে দ্রুত টেস্ট
      করা যায়)
- [ ] নম্বর বসার পরে notification-এও সঠিক final নম্বর আপডেট হয়েছে কিনা
      (আগের "OFFLINE-" রিপ্লেস হয়ে) যাচাই করুন
- [ ] ডেলিভারি চালান প্রিন্ট করে দেখুন — প্রতিষ্ঠানের নাম/লোগো (আপলোড করা
      থাকলে)/ঠিকানা, আইটেম তালিকা, বকেয়া সঠিক দেখাচ্ছে কিনা

### ৬.৩ Order ফ্লো (অফলাইন সিনারিও)
- [ ] ব্রাউজার DevTools → Network → "Offline" চালু করে একটা অর্ডার তৈরি
      করুন — "সংরক্ষিত হয়েছে, ইন্টারনেট এলে সিঙ্ক হবে" মেসেজ দেখাচ্ছে কিনা
- [ ] নেভবারে লাল বিন্দু + "অফলাইন | X টি সিঙ্ক হয়নি" দেখাচ্ছে কিনা
- [ ] Network আবার "Online" করে দিলে অর্ডার সিঙ্ক হচ্ছে ও সবুজ বিন্দুতে
      ফিরছে কিনা
- [ ] পুরোপুরি অফলাইনে তৈরি অর্ডারের notification ইন্টারনেট ফেরার পরে
      পাওয়া যাচ্ছে কিনা (Direct-Call Pattern-এর ডকুমেন্টেড সীমাবদ্ধতা —
      দেরি প্রত্যাশিত, একদমই না আসাটা bug)
- [ ] অফলাইন অর্ডারের `orderNumber` সিঙ্কের পরে polling দিয়ে সঠিকভাবে
      বসছে কিনা (২-৫ মিনিটের মধ্যে, blueprint-এ ডকুমেন্টেড known limitation)

### ৬.৪ Logo Upload ফ্লো (Cloudinary, Phase F1 #8-এর সাথে সরাসরি সম্পর্কিত)
- [ ] Tenant Settings → সাধারণ তথ্য ট্যাবে সঠিক image ফাইল (2MB-এর কম, jpg/
      png/webp) আপলোড করুন — সফল হচ্ছে কিনা, `logoUrl` Firestore-এ
      `res.cloudinary.com` ডোমেইনের একটা URL হিসেবে সেভ হচ্ছে কিনা
- [ ] আপলোডের পরে পেজ রিফ্রেশ করে লোগো এখনো দেখাচ্ছে কিনা (persisted হয়েছে
      প্রমাণ)
- [ ] non-image ফাইল (যেমন .pdf) সিলেক্ট করে দেখুন — client-side ভ্যালিডেশন
      এরর দেখাচ্ছে কিনা, Cloudinary-তে কোনো রিকোয়েস্ট না গিয়েই ব্লক হচ্ছে
      কিনা (Network ট্যাবে যাচাই করুন)
- [ ] 2MB-এর বেশি সাইজের ইমেজ সিলেক্ট করে দেখুন — client-side এরর দেখাচ্ছে
      কিনা
- [ ] `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` ইচ্ছাকৃতভাবে ভুল বসিয়ে (বা
      Netlify env var সাময়িকভাবে খালি রেখে) দেখুন — এরর অবস্থায় স্পষ্ট
      Bengali এরর মেসেজ দেখাচ্ছে কিনা (silent failure নয়), পরীক্ষা শেষে
      সঠিক মান ফেরত বসান
- [ ] আপলোড করা লোগো ডেলিভারি চালান, কোটেশন প্রিন্ট ভিউ, ও কাস্টমার পোর্টাল
      ইনভয়েস ভিউ — তিন জায়গাতেই দেখা যাচ্ছে কিনা
- [ ] একই তারিখে দুইবার লোগো আপলোড করে দেখুন — নতুনটাই শেষ পর্যন্ত UI-তে
      দেখাচ্ছে কিনা (পুরনোটা Cloudinary-তে orphaned থেকে যাওয়াটা প্রত্যাশিত,
      কোনো bug নয় — উপরের MODULE_README নোট দেখুন)

### ৬.৫ Quotation ফ্লো
- [ ] নতুন কোটেশন তৈরি করুন, কয়েক মিনিট পরে `quotationNumber`
      "OFFLINE-..." থেকে `QT-2026-XXXX`-এ বদলেছে কিনা যাচাই করুন
- [ ] Accepted কোটেশন থেকে এক ক্লিকে অর্ডার তৈরি হচ্ছে কিনা

### ৬.৬ Portal Tracking
- [ ] `/portal/{tenantId}/{orderId}` লগইন ছাড়াই খুলে স্ট্যাটাস/টাইমলাইন/
      ইনভয়েস দেখাচ্ছে কিনা

### ৬.৭ Scheduled Functions (Netlify UI)
- [ ] Functions ট্যাবে পাঁচটাই "Scheduled" ব্যাজ সহ দেখাচ্ছে: `check-trial-
      expiry`, `check-quotation-expiry`, `send-daily-notifications`,
      `generate-order-numbers`, `generate-quotation-numbers`
- [ ] প্রতিটার "Run now" দিয়ে ম্যানুয়াল ট্রিগার করে function log-এ কোনো
      unhandled error নেই তা যাচাই করুন

### ৬.৮ ভাষা টগল
- [ ] `[বাং | EN]` টগল করে পুরো ড্যাশবোর্ড (মেনু, বাটন, স্ট্যাটাস ব্যাজ,
      লোগো আপলোডের error/success মেসেজ সহ) তাৎক্ষণিক পরিবর্তন হচ্ছে কিনা,
      পেজ রিলোড ছাড়াই

---

## পরবর্তী ধাপ

Phase F1 #8 (Cloudinary migration) সম্পন্ন — Migration Map-এর সব আইটেম এখন
প্রকৃতপক্ষে সম্পূর্ণ। উপরের সেকশন ৬-এর চেকলিস্ট Netlify Preview URL-এ চালিয়ে
সব আইটেম pass করলে:
- Phase F2 #13 — ডোমেইন/সাবডোমেইন সংযোগ
- Phase F2 #14 — প্রথম টেস্ট কাস্টমার অনবোর্ডিং
- Phase F2 #15 — Netlify credit usage ও Firestore quota মনিটরিং সেটআপ
