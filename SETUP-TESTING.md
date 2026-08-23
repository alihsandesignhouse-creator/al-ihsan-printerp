# AL-IHSAN PrintERP — লোকালহোস্টে টেস্ট করার গাইড (Firebase Emulator দিয়ে)

এই গাইড অনুসরণ করলে GitHub রিপো খোলা বা Cloud Functions deploy করা **ছাড়াই** পুরো
অ্যাপ — signup, tenant creation, login, dashboard — সব localhost-এ টেস্ট করতে পারবেন।

## গুরুত্বপূর্ণ একটি বিষয় আগে বুঝে নিন

GitHub-এর সাথে tenant creation কাজ করা না-করার কোনো সম্পর্ক নেই। GitHub শুধু
কোড সংরক্ষণের জায়গা। কিন্তু **Firebase Auth, Firestore, Cloud Functions** —
এগুলো সবসময় Firebase-এর backend-এ চলে, আপনার নিজের কম্পিউটারে নয়। তাই
আগে যখন tenant create হয়নি, তার কারণ সম্ভবত ছিল: `.env.local` ফাইলই ছিল না,
অথবা Cloud Function কোথাও deploy করা ছিল না — ফলে `/signup` বা Super Admin-এর
"নতুন টেন্যান্ট তৈরি" বাটন backend-এর কোনো ঠিকানাই খুঁজে পায়নি।

এই সেশনে **Firebase Emulator Suite** যোগ করা হয়েছে, যা Firebase-এর পুরো backend
(Auth + Firestore + Cloud Functions + Storage)-কে আপনার নিজের কম্পিউটারে নকল করে চালায় —
কোনো টাকা খরচ নেই, কোনো Blaze plan লাগে না, কোনো deploy লাগে না।

## ধাপ ১ — একটি Firebase প্রজেক্ট তৈরি (শুধু কনফিগের জন্য, deploy নয়)

1. https://console.firebase.google.com → "Add project" → যেকোনো নাম দিন (যেমন `printerp-dev`)
2. প্রজেক্টের ভেতরে **Project Settings → General → Your apps → Web app (</>) যোগ করুন**
3. যে config অবজেক্ট দেখাবে (`apiKey`, `authDomain`, `projectId` ইত্যাদি) — এগুলো টুকে রাখুন
4. **Authentication → Sign-in method → Email/Password চালু করুন** (এটা emulator-এও একবার UI-তে সক্রিয় দেখানো ভালো অভ্যাস, যদিও emulator বাস্তবে Console সেটিং না দেখেই কাজ করে)

*(Blaze billing plan-এ upgrade করার দরকার নেই — emulator টেস্টের জন্য Spark/ফ্রি প্ল্যানই যথেষ্ট)*

## ধাপ ২ — `.env.local` তৈরি করুন

```bash
cp .env.local.example .env.local
```

এরপর `.env.local`-এ ধাপ ১-এর মান বসান, এবং নিচের দুটো লাইন অবশ্যই এভাবে রাখুন:

```
CLOUD_FUNCTION_BASE_URL=
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
```

## ধাপ ৩ — নির্ভরতা ইনস্টল

```bash
npm install
cd functions && npm install && cd ..
```

Firebase CLI গ্লোবালি ইনস্টল না থাকলে:

```bash
npm install -g firebase-tools
firebase login
```

## ধাপ ৪ — Emulator চালু করুন (আলাদা টার্মিনালে, চালু রাখুন)

```bash
npm run emulators
```

এটা http://127.0.0.1:4000 -এ একটা Emulator UI খুলবে (Auth, Firestore, Functions সব একসাথে দেখা যাবে)।

## ধাপ ৫ — Next.js dev server চালু (দ্বিতীয় টার্মিনালে)

```bash
npm run dev
```

http://localhost:3000 খুলুন।

## ধাপ ৬ — নতুন টেন্যান্ট তৈরি টেস্ট করুন (দুইভাবে)

**A) Self-Signup (Trial) দিয়ে:**
- http://localhost:3000/signup এ যান
- ফর্ম পূরণ করে সাবমিট করুন
- সফল হলে ১.২ সেকেন্ড পর `/dashboard`-এ redirect হবে, Trial banner দেখা যাবে
- Emulator UI-এর Auth ট্যাবে (http://127.0.0.1:4000/auth) নতুন ইউজার দেখা যাবে, Firestore ট্যাবে `tenants/{uid}` ডকুমেন্ট দেখা যাবে

**B) Super Admin থেকে "নতুন টেন্যান্ট তৈরি" দিয়ে:**
- প্রথমে নিজেকে Super Admin বানাতে হবে — উপরের A ধাপে একবার সাইন আপ করুন (বা যেকোনো email/password দিয়ে), তারপর:
  ```bash
  npm run set-super-admin:emulator -- owner@example.com
  ```
- ব্রাউজারে লগআউট করে আবার লগইন করুন — এখন `/super-admin/dashboard` এ যাবেন
- "টেন্যান্ট ব্যবস্থাপনা" → "নতুন টেন্যান্ট" ফর্ম পূরণ করে টেস্ট করুন

## ধাপ ৭ — পরবর্তী সেশনগুলোর মডিউল টেস্ট করুন

এই গাইড প্রথম লেখার পর আরও কিছু মডিউল যোগ হয়েছে। বেশিরভাগই আলাদা কোনো সেটআপ ছাড়াই ধাপ ১-৬-এর একই emulator দিয়ে কাজ করে, শুধু একটাতে (গ্রাহক পোর্টাল) একটু বাড়তি প্রস্তুতি লাগে:

**Audit Log ও ডেটা এক্সপোর্ট** — এই দুটো সম্পূর্ণ ক্লায়েন্ট-সাইড + Firestore, আলাদা কোনো Cloud Function বা পরিবেশ কনফিগ লাগে না। Tenant Admin হিসেবে লগইন করে `/dashboard/audit-log` এবং যেকোনো তালিকা পেজে (অর্ডার/কাস্টমার/খরচ/স্টক/সাপ্লায়ার) এক্সপোর্ট বাটন দেখা উচিত। এক্সপোর্ট বাটন লকড দেখালে (Lock আইকন) — টেস্ট টেন্যান্টের প্ল্যান "প্রিমিয়াম" না হওয়ার কারণে; Emulator UI-এর Firestore ট্যাবে `tenants/{tenantId}` ডকুমেন্টে গিয়ে `planId` ম্যানুয়ালি `"premium"` করে দিলে আনলক হয়ে যাবে।

**গ্রাহক পোর্টাল (T-20)** — এটা তৃতীয় একটা পাবলিক (লগইন-বিহীন) `onRequest` ফাংশন ব্যবহার করে (`getPortalOrderStatus`), তাই ধাপ ৪-এর Functions emulator চালু থাকা আবশ্যক। টেস্ট করতে:
1. উপরের মতো টেন্যান্টের `planId` Emulator UI থেকে `"premium"` করুন (কাস্টমার পোর্টাল প্রিমিয়াম-শুধু ফিচার)
2. Dashboard থেকে একটা টেস্ট অর্ডার তৈরি করুন — একটা কাস্টমার নাম, বৈধ বাংলাদেশী মোবাইল নম্বর (`01XXXXXXXXX`) ও অন্তত একটা আইটেম দিয়ে
3. Firestore ট্যাবে সেই অর্ডারের `orderNumber` ফিল্ডটা টুকে রাখুন
4. ব্রাউজারে `http://localhost:3000/portal/{tenantId}` এ যান (tenantId = Auth ট্যাবের সেই ইউজারের UID, যেহেতু tenant document-এর ID-ই UID)
5. অর্ডার নম্বর ও একই মোবাইল নম্বর দিয়ে "ট্র্যাক করুন" — স্ট্যাটাস টাইমলাইন ও ইনভয়েস দেখা উচিত
6. ভুল মোবাইল নম্বর দিয়ে টেস্ট করলে "অর্ডার পাওয়া যায়নি" আসা উচিত (এটাই সঠিক আচরণ — নিরাপত্তার জন্য ইচ্ছাকৃতভাবে একই বার্তা)

## ধাপ ৭.৫ — টেন্যান্ট স্থায়ী ডিলিট (সেশন ৯, ১৮ আগস্ট ২০২৬) — emulator-এ বাধ্যতামূলক টেস্ট

⚠️ **এই ফিচারটা ফেরত-অযোগ্য হার্ড-ডিলিট।** কোনো real/প্রোডাকশন টেন্যান্টে
প্রথমবার চালানোর আগে অবশ্যই emulator-এ একটা টেস্ট-টেন্যান্ট দিয়ে যাচাই করুন
— Claude নিজে emulator চালাতে/UI ক্লিক করতে পারে না, এই ধাপটা
ব্যবহারকারীকে (Muslima) নিজে করতে হবে।

**টেস্ট প্রস্তুতি:**
1. Emulator UI (`http://localhost:4000`) থেকে বা Super Admin প্যানেল দিয়ে
   একটা নতুন টেস্ট-টেন্যান্ট বানান (যেমন নাম দিন "টেস্ট প্রেস — ডিলিট")
2. সেই টেন্যান্টে লগইন করে অন্তত এইগুলো তৈরি করুন যাতে recursiveDelete
   আসলেই কিছু গভীর নেস্টেড ডেটা মুছছে কিনা বোঝা যায়:
   - একটা multi-item অর্ডার (যাতে নেস্টেড `order_items` সাবকালেকশন তৈরি হয়)
   - একটা কোটেশন (নেস্টেড `quotation_items`-এর জন্য)
   - অন্তত একজন স্টাফ সদস্য (`users` সাবকালেকশন + তার নিজস্ব Auth user)
   - একটা কাস্টমার + একটা পেমেন্ট

**টেস্ট করুন:**
1. Super Admin প্যানেলে `/super-admin/tenants` পেজে যান, সেই টেস্ট-টেন্যান্টের
   "..." মেনুতে ক্লিক করে "স্থায়ীভাবে ডিলিট করুন" চাপুন
2. মোডালে টেন্যান্টের নাম হুবহু টাইপ না করা পর্যন্ত বাটন disabled থাকা
   উচিত — ভুল বানান/আংশিক নাম দিয়ে টেস্ট করে নিশ্চিত হন
3. সঠিক নাম টাইপ করে "স্থায়ীভাবে ডিলিট করুন" চাপুন
4. Emulator UI-এর Firestore ট্যাবে গিয়ে নিশ্চিত করুন:
   - `tenants/{tenantId}` ডকুমেন্ট ও তার সব সাবকালেকশন (orders + নেস্টেড
     order_items, quotations + নেস্টেড quotation_items, users, customers,
     payments সহ) সম্পূর্ণ চলে গেছে
   - নতুন top-level `tenant_deletion_log` কালেকশনে একটা এন্ট্রি তৈরি হয়েছে
     (deletedByAdminId, tenantName ইত্যাদি সহ)
5. Emulator UI-এর Auth ট্যাবে গিয়ে নিশ্চিত করুন tenant_admin ও স্টাফের
   Auth user দুটোই মুছে গেছে
6. তালিকা পেজে টেন্যান্টটা রিয়েলটাইমে (রিফ্রেশ ছাড়াই) অদৃশ্য হয়ে যাওয়া
   উচিত (subscribeTenants লিসেনার স্বয়ংক্রিয়ভাবে আপডেট করে)

**যদি টাইমআউট/এরর হয়:** ম্যানুয়ালি খুব বড় ডেটাসেট (হাজার হাজার অর্ডার) দিয়ে
টেস্ট করা কঠিন হলেও, রুটের হেডার কমেন্টে (`app/api/super-admin/
delete-tenant/route.ts`) ব্যাখ্যা করা আছে কেন এটা নিরাপদে আবার চালানো যায়
(idempotent) — একবার ব্যর্থ হলে আবার একই বাটনে ক্লিক করলে বাকি অংশ চলতে
থাকবে।

## ধাপ ৮ — সব API route/Cloud Function একসাথে তালিকা (ডিবাগ করার সময় দ্রুত রেফারেন্স)

`.env.local`-এর `CLOUD_FUNCTION_BASE_URL`/emulator সেটআপের উপর নির্ভরশীল Next.js API route:

| Next.js Route | Cloud Function | পাবলিক/সুরক্ষিত |
|---|---|---|
| `/api/auth/signup` | `onTenantSelfSignup` | পাবলিক |
| `/api/super-admin/create-tenant` | `onAdminCreateTenant` | Super Admin (Bearer token) |
| `/api/portal/track` | `getPortalOrderStatus` | পাবলিক (phone verification) |

এই তিনটার যেকোনোটা "Cloud Function URL not configured" বা HTML/JSON পার্স এরর দিলে — সমস্যা প্রায় সবসময় একই জায়গায় (উপরের "সমস্যা হলে" সেকশন দেখুন), route ভিন্ন হলেও কারণ একই।

## সমস্যা হলে

- **"Cloud Function URL not configured"** → `.env.local`-এ `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` এবং `NEXT_PUBLIC_FIREBASE_PROJECT_ID` ঠিকমতো বসানো আছে কিনা দেখুন, dev server রিস্টার্ট করুন (`.env.local` পরিবর্তনের পর সবসময় রিস্টার্ট লাগবে)
- **Functions emulator এরর দেখাচ্ছে** → `functions/` ফোল্ডারে `npm install` করেছেন কিনা দেখুন, এবং `functions/src/index.ts`-এ প্রতিটি মডিউলের ফাংশন সঠিকভাবে `export` করা আছে কিনা দেখুন (প্রতিটি নতুন মডিউল সেশনের `MODULE_README.md` এন্ট্রিতে কোন ফাংশন নতুন যোগ হয়েছে তা লেখা থাকে)
- **Firestore permission-denied** → `firestore.rules` emulator স্বয়ংক্রিয়ভাবে লোড করে (`firebase.json`-এর `firestore.rules` পাথ থেকে) — emulator রিস্টার্ট করলে rules রিলোড হয়
- **ব্রাউজারে এই এরর দেখাচ্ছে: `Unexpected token '<' ... is not valid JSON`** (Sign Up বা Super Admin-এর "নতুন টেন্যান্ট" ফর্ম সাবমিট করার সময়) → এর মানে `/api/auth/signup` বা `/api/super-admin/create-tenant` রুট থেকে JSON-এর বদলে HTML পেয়েছে ব্রাউজার। এটা প্রায় সবসময় নিচের একটার কারণে হয়, ক্রমানুসারে চেক করুন:
  1. **Functions emulator আদৌ চালু হয়েছে কিনা** — যে টার্মিনালে `npm run emulators` চালিয়েছেন, সেখানে স্ক্রল করে দেখুন "functions" লাইনে কোনো লাল Error আছে কিনা। TypeScript কম্পাইল না হলে (`functions/lib/` ফোল্ডার তৈরি না হলে) Functions emulator পোর্ট ৫০০১-এ কিছুই সার্ভ করে না।
     - এই সেশন থেকে `firebase.json`-এ একটা `predeploy` হুক যোগ করা হয়েছে যেটা `firebase emulators:start` চালানোর সময় স্বয়ংক্রিয়ভাবে `functions`-এর TypeScript বিল্ড করে দেবে — তাই এখন থেকে আলাদা করে `cd functions && npm run build` করার দরকার নেই, শুধু emulator রিস্টার্ট করুন। যদি এখনো এরর দেখেন, একবার ম্যানুয়ালি `cd functions && npm run build` চালিয়ে কোনো TypeScript এরর আসে কিনা দেখুন।
  2. **ব্রাউজারের DevTools → Network ট্যাবে** ফেইল হওয়া রিকোয়েস্টে ক্লিক করে "Response" ট্যাব দেখুন — HTML-টা আসলে কী পেজ (৪০৪? অন্য কোনো এরর পেজ?) সেটা বুঝলে কারণ নিশ্চিত হওয়া সহজ হয়
  3. `.env.local` পরিবর্তনের পর dev server (`npm run dev`) রিস্টার্ট করেছেন কিনা নিশ্চিত করুন — Next.js env var একবার লোড হওয়ার পর রিস্টার্ট ছাড়া পরিবর্তন প্রতিফলিত হয় না
  4. দুটো টার্মিনালই (emulators + dev server) এখনো চলমান আছে কিনা এবং কোনোটা crash করে বন্ধ হয়ে যায়নি তো — Ctrl+C চাপার পর ভুলে দুটোর একটা আবার চালু না করা একটা সাধারণ ভুল

## Production-এ যাওয়ার সময় (পরে, কোডিং শেষ হলে)

তখন `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false` করে দিন, `firebase deploy --only functions` (Blaze plan লাগবে) এবং `firebase deploy --only firestore:rules,firestore:indexes` চালান, আর `.env.local`-এ আসল `CLOUD_FUNCTION_BASE_URL` বসান।
