# AUDIT-REPORT-5.md — পূর্ণাঙ্গ কোডবেস অডিট (৪ আগস্ট ২০২৬)

> এই অডিট AUDIT-REPORT-3.md (৬-ব্যাচ সিকিউরিটি/লজিক অডিট, ২ আগস্ট ২০২৬) ও
> AUDIT-REPORT-4-UIUX.md (৭-ইস্যু UI/UX ফিক্স)-এর ধারাবাহিকতায়। আগের কোনো
> ফিক্স-করা ইস্যু এখানে পুনরায় রিপোর্ট করা হয়নি — শুধু regression বা
> সম্পূর্ণ নতুন/আগে-স্কোপের-বাইরে-থাকা ইস্যু। **এই সেশনে কোনো কোড পরিবর্তন
> করা হয়নি — শুধু অডিট।**

---

## ০. এই সেশনে যা যাচাই করা গেছে vs যা যায়নি (sandbox সীমাবদ্ধতা)

| আইটেম | ফলাফল |
|---|---|
| `npx tsc --noEmit` | ✅ **0 errors** (পুরো কোডবেস, `node_modules` fresh install করে) |
| `npx eslint . --ext .ts,.tsx` | ✅ **0 errors**, ২টা পরিচিত/অপ্রাসঙ্গিক warning (একই যা AUDIT-REPORT-3-এ ছিল: `app/layout.tsx`-এ Next.js font warning, `functions/src/tenantFunctions.ts`-এ console.log) |
| `npm run build` (production) | ❌ **এখনো verify করা যায়নি** — এই sandbox-এর network egress allowlist-এ `fonts.googleapis.com` নেই, তাই `next/font/google` (Inter, Hind Siliguri, Noto Sans Bengali, JetBrains Mono) fetch করতে ব্যর্থ হয়ে build fail করে। এটা কোডের বাগ না, environment limitation — AUDIT-REPORT-3-এ যা রিপোর্ট করা হয়েছিল ঠিক একই কারণ, এখনো অপরিবর্তিত। **সুপারিশ:** আপনার নিজের মেশিনে (বা Netlify-এর build environment-এ, যেখানে ওই ডোমেইন allow করা আছে) `npm run build` চালিয়ে Next.js 14.2.35 আপগ্রেডের পর কোনো breaking change নেই তা নিশ্চিত করুন। |
| Firebase emulator দিয়ে `firestore.rules` টেস্ট (payments amount≤dueAmount, audit_logs userId match) | ❌ **চালানো যায়নি** — Firestore emulator জার (`cloud-firestore-emulator-v1.22.0.jar`) ডাউনলোড করতে `storage.googleapis.com`-এ যেতে হয়, যা এই sandbox-এর allowlist-এ নেই (`firebase-tools` নিজে ইনস্টল হয়েছে, কিন্তু emulator start করতে গিয়ে `403: Host not in allowlist` error)। এর বদলে দুটো rule-ই **ম্যানুয়ালি/স্ট্যাটিকভাবে লাইন-বাই-লাইন পড়ে** যাচাই করা হয়েছে — নিচে §১-এ ফলাফল। **সুপারিশ:** আপনার স্থানীয় মেশিনে `firebase emulators:start --only firestore` চালিয়ে অন্তত এই দুটো rule-এর জন্য একটা positive + একটা negative টেস্ট কেস দিয়ে বাস্তবে নিশ্চিত করুন। |

---

## ১. আগের দুই অডিটের "যাচাই করা যায়নি" আইটেম বন্ধ করা — ফলাফল

### ১.১ `payments` create rule (`amount <= order.dueAmount`) — ✅ স্ট্যাটিক রিভিউতে সঠিক
`firestore.rules` লাইন ২২৩-২৩০: `request.resource.data.amount <= get(...orders/orderId).data.dueAmount`।
`get()` ওই মুহূর্তে অর্ডারের *কমিটেড* (এই পেমেন্ট-write-এর আগের) `dueAmount` পড়ে, তাই একক পেমেন্ট
কখনো তার নিজের due-এর চেয়ে বেশি হতে পারবে না — যেভাবে ডকুমেন্টেড, ঠিক তেমনই কাজ করবে বলে
কোড-লেভেলে নিশ্চিত। ক্লায়েন্ট-সাইড `recordPayment()` (`lib/firebase/orders.ts`)-ও একই চেক
`runTransaction`-এর ভেতরে করে, তাই ডাবল-প্রোটেকশন আছে। **তবে এই রিভিউ থেকেই একটা নতুন,
আলাদা গ্যাপ পাওয়া গেছে — নিচে ইস্যু #১ দেখুন।**

### ১.২ `audit_logs` create rule (`userId == request.auth.uid`) — ✅ স্ট্যাটিক রিভিউতে সঠিক
লাইন ২৮৯-২৯০: legitimate write path (`lib/firebase/audit.ts`-এর `logAuthEvent`/`logAction`) সবসময়
`auth.currentUser.uid` থেকে userId সেট করে, param থেকে না — তাই এই rule সব বৈধ write-এর জন্য
no-op, শুধু spoofed write ব্লক করে। কোড রিভিউ নিশ্চিত করে এই দাবি সঠিক।

---

## ২. নতুন ইস্যু

### ইস্যু #১ — Staff রোল রেফারেন্সবিহীনভাবে অর্ডারের `dueAmount` কমাতে পারে, কোনো payment রেকর্ড ছাড়াই
**সেভেরিটি: High** · **ফাইল:** `firestore.rules` লাইন ১৭৬-১৮১ (orders update rule, `isStaff()` branch)

```javascript
|| (isStaff()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["status", "dueAmount", "updatedAt"])
    && request.resource.data.dueAmount <= resource.data.dueAmount)
```

**সমস্যা:** এই rule শুধু নিশ্চিত করে `dueAmount` কমছে (বাড়ছে না), কিন্তু এই কমার পরিমাণ যে আসলেই
কোনো `payments/{paymentId}` ডকুমেন্ট তৈরির সাথে সংযুক্ত তা কোথাও enforce করা হয় না। বৈধ অ্যাপ UI
(`recordPayment()`) সবসময় `payments.create` + `orders.update`-কে একটা `runTransaction`-এ একসাথে
করে ঠিক payment-এর amount দিয়েই due কমায় — কিন্তু raw Firestore SDK দিয়ে (অ্যাপ UI বাইপাস করে)
commission_staff/regular_staff role-এর যেকোনো ব্যবহারকারী শুধুমাত্র `orders/{orderId}` ডকুমেন্টে
`dueAmount: 0` লিখে **কোনো payment ডকুমেন্ট তৈরি না করেই** একটা কাস্টমারের পুরো বকেয়া "মুছে"
দিতে পারবে — কোনো payment ledger এন্ট্রি নেই, তাই টাকা আসলেই সংগ্রহ হয়েছে কিনা তার কোনো প্রমাণ
নেই (embezzlement/write-off ঝুঁকি)। ব্লুপ্রিন্টের রোল-পারমিশন টেবিল (অংশ ৩.২) অনুযায়ী staff-এর
অনুমতি হলো "গ্রাহকের কাছ থেকে **পেমেন্ট সংগ্রহ ও রেকর্ড**" — অর্থাৎ due কমানো সবসময় একটা payment
রেকর্ডের সাথে বাঁধা থাকার কথা।

**উল্লেখ্য:** এটা AUDIT-REPORT-3.md Issue #4 (payment amount uncapped)-এর থেকে আলাদা একটা গ্যাপ —
Issue #4 সমাধান করেছে "একটা payment দিয়ে due-এর চেয়ে বেশি claim করা"; এই ইস্যু হলো "কোনো payment
ছাড়াই due কমানো"। Firestore rules ডকুমেন্ট-লেভেলে কাজ করে বলে দুটো write-কে ক্রস-ভ্যালিডেট করা
সহজ না — একটা সমাধান-দিক হতে পারে rule-এ `dueAmount` পরিবর্তনযোগ্য একেবারেই না রাখা (শুধু
`status`+`updatedAt` allow করা) এবং due-কমানো *শুধুমাত্র* payment-write-এর মাধ্যমে (Cloud
Function/Admin SDK ট্রিগার, বা payment-create rule-এ order-update-কেও একটা batched write হিসেবে
বাধ্য করা) — কিন্তু এটা একটা আর্কিটেকচার সিদ্ধান্ত, তাই এখানে শুধু চিহ্নিত করা হলো, ফিক্স করা হয়নি
(এই সেশনের নিয়ম অনুযায়ী)।

### ইস্যু #২ — `maxBranches` প্ল্যান-লিমিট কোথাও enforce করা হয় না
**সেভেরিটি: Medium-High (রেভিনিউ-প্রভাবক)** · **ফাইল:** `lib/firebase/branches.ts` (`createBranch`), `firestore.rules` লাইন ১২০-১২৪

ব্লুপ্রিন্টের অংশ ৪.৩ অনুযায়ী সর্বোচ্চ শাখা: বেসিক = ১টি, স্ট্যান্ডার্ড = ৩টি, প্রিমিয়াম = সীমাহীন।
`lib/types/subscription-plan.ts`-এ `maxBranches` ফিল্ড সংজ্ঞায়িতও আছে এবং Super Admin-এর প্যাকেজ
পেজে (SA-03) দেখানোও হয়। কিন্তু:
- `createBranch()`-এ কোনো count-check নেই
- `firestore.rules`-এর branches `create` rule শুধু `isTenantAdmin()` চেক করে — কোনো plan-limit চেক নেই
- staff limit-এর জন্য যেমন `getPlanLimit()`/`countActiveStaff()` (`lib/server/staff-helpers.ts`) আছে
  এবং API route-এ enforce হয়, শাখার জন্য সমতুল্য কিছু নেই

**প্রভাব:** একজন Basic-প্ল্যান tenant_admin সীমাহীন শাখা তৈরি করতে পারবেন — যা তাদের প্যাকেজের বাইরের
সুবিধা বিনামূল্যে পাওয়ার সমান (Standard/Premium-only মাল্টি-ব্রাঞ্চ ক্ষমতা)। এটা staff-limit
enforcement-এর প্যাটার্নের সাথে অসামঞ্জস্যপূর্ণ (staff-এ ঠিকভাবে করা আছে, branch-এ বাদ পড়ে গেছে)।

**ফিক্স-দিক-নির্দেশনা:** `staff-helpers.ts`-এর প্যাটার্ন অনুসরণ করে `getBranchLimit()` +
`countActiveBranches()` যোগ করে branch-creation UI/API-এ চেক করুন, এবং সম্ভব হলে
`firestore.rules`-এও (staff-limit-এর মতো, `get()` দিয়ে branch-count cross-check সরাসরি rules-এ
করাও সম্ভব, staff-এর ক্ষেত্রে যেমন Cloud-Function-only রাখা হয়েছে সেভাবে API-route-only করাও যায়়)।

### ইস্যু #৩ — `orderIdPrefix` ডিফল্ট মান সব জায়গায় ড্যাশ ছাড়া, কিন্তু ব্লুপ্রিন্টের উদাহরণ ড্যাশসহ
**সেভেরিটি: Low (কসমেটিক, তবে সব tenant-কে প্রভাবিত করে)** · **ফাইল:** `app/api/auth/signup/route.ts:133`, `components/super-admin/CreateTenantModal.tsx:75`

যাচাই করে নিশ্চিত হলো MODULE_README.md-এর বর্ণনার চেয়ে বাস্তবতা একটু ভিন্ন — এটা শুধু
"self-signup vs admin-created" এর মধ্যে অসামঞ্জস্য না, বরং **দুটোই** ডিফল্ট `orderIdPrefix: 'PP'`
(ড্যাশ ছাড়া) ব্যবহার করে:
- `onTenantSelfSignup`/`app/api/auth/signup/route.ts`: `orderIdPrefix: "PP"`
- Super Admin-এর "নতুন টেন্যান্ট" ফর্মের ডিফল্ট ভ্যালুও: `orderIdPrefix: 'PP'`

`netlify/functions/generate-order-numbers.mts`-এর fallback `"PP-"` (ড্যাশসহ) তাই বাস্তবে প্রায়
কখনোই ট্রিগার হয় না — শুধুমাত্র সেই বিরল legacy tenant ডকুমেন্টের জন্য যেখানে `orderIdPrefix`
ফিল্ডটাই একদম নেই। ফলাফল: ব্লুপ্রিন্টের অংশ ২.৪-এ দেখানো উদাহরণ (`PP-2026-0001`) না হয়ে বেশিরভাগ
tenant-এর অর্ডার নম্বর দেখাবে `PP2026-0001` (ড্যাশ ছাড়া) — যদি না Super Admin ম্যানুয়ালি "PP-"
টাইপ করেন prefix ফিল্ডে। ফাংশনাল কোনো বাগ নেই (নম্বর এখনো ইউনিক ও sequential), শুধু ফরম্যাট
ব্লুপ্রিন্ট-ডকুমেন্টেশনের সাথে মেলে না। **সিদ্ধান্ত আপনার:** (ক) ডিফল্ট ভ্যালু দুই জায়গাতেই `"PP-"`
করে দিন যদি ড্যাশসহ ফরম্যাট চান, অথবা (খ) কিছু না করে এটাকে "স্ট্যান্ডার্ড ফরম্যাট" হিসেবে মেনে নিন
এবং শুধু ব্লুপ্রিন্ট ডকুমেন্টের উদাহরণটা আপডেট করুন যাতে ভবিষ্যতে আবার "বাগ" মনে না হয়।

### ইস্যু #৪ — মোবাইলে অন-স্ক্রিন প্রিভিউ টেবিলে `overflow-x-auto` নেই (item-analysis-table.tsx-এর একই প্যাটার্ন, নতুন জায়গায়)
**সেভেরিটি: Medium** · **ফাইল:** `components/tenant/orders/delivery-challan.tsx:81`, `components/tenant/quotations/quotation-print-view.tsx:80`, `components/tenant/zakat/zakat-distribution-section.tsx:88-89`

AUDIT-REPORT-4-UIUX.md-এর Issue #5 (item-analysis-table.tsx) ঠিক এই একই প্যাটার্নের একটা বাগ
ফিক্স করেছিল — কিন্তু "পূর্ণাঙ্গ deeper scan হয়নি" বলে সেই রিপোর্টেই স্বীকার করা ছিল। এই সেশনে
পুরো `components/`+`app/` জুড়ে raw `<table>` ব্যবহার খুঁজে বের করার heuরিস্টিক স্ক্যানে তিনটা নতুন
জায়গা পাওয়া গেছে যেখানে horizontal scroll wrapper নেই:

- `delivery-challan.tsx` ও `quotation-print-view.tsx` — এই দুটো `window.print()`-এর জন্য বানানো
  হলেও, উভয়ই যথাক্রমে `app/(tenant)/dashboard/orders/[orderId]/page.tsx` ও
  `.../quotations/[quotationId]/page.tsx`-এ **অন-স্ক্রিন প্রিভিউ হিসেবেও রেন্ডার হয়** (শুধু
  print-only আইসোলেটেড পেজ না) — অ্যাপের নিজস্ব ডিজাইনই মোবাইল-ফার্স্ট (bottom-nav, PWA), তাই
  ফোনে অর্ডার/কোটেশন দেখতে গেলে এই টেবিল সংকীর্ণ স্ক্রিনে কাটা পড়তে পারে।
- `zakat-distribution-section.tsx` — `overflow-y-auto` আছে (ভার্টিক্যাল স্ক্রলযোগ্য লিস্ট) কিন্তু
  `overflow-x-auto` নেই — কলাম বেশি হলে (তারিখ/খাত/পরিমাণ/পদ্ধতি/গ্রহীতা) মোবাইলে হরাইজন্টালি কাটা
  পড়তে পারে।

**ফিক্স-দিক-নির্দেশনা:** ঠিক আগেরবার item-analysis-table.tsx-এ যে প্যাটার্ন ব্যবহার হয়েছিল
(`<div className="overflow-x-auto">` দিয়ে টেবিল মুড়ে দেওয়া, `@media print`-এ ওই wrapper-এর
overflow constraint যাতে প্রিন্ট আউটে প্রভাব না ফেলে তা নিশ্চিত করে) — সেটাই এই তিন জায়গায়ও
প্রয়োগ করুন।

**যাচাই করে ক্লিন পাওয়া গেছে (এই স্ক্যানের ফলস পজিটিভ):** `components/ui/table.tsx` (shadcn
বেস কম্পোনেন্ট) নিজেই `overflow-auto` wrapper দিয়ে আসে — grep miss করেছিল কারণ ক্লাসটা
`overflow-x-auto` না, `overflow-auto`। এটা ব্যবহার করা অন্য সব টেবিল (যেগুলো `<Table>` কম্পোনেন্ট
দিয়ে বানানো, raw `<table>` না) নিরাপদ।

---

### ইস্যু #৫ — `check-trial-expiry.mts`-এ audit-log ডকুমেন্ট auto-generated ID (deterministic না)
**সেভেরিটি: Low** · **ফাইল:** `netlify/functions/check-trial-expiry.mts` (audit log write, `doc.ref.collection("audit_logs").doc()`)

এই ফাংশনের বাকি সব অংশ সঠিকভাবে ডিজাইন করা — `syncTenantUserClaims` প্রতিটা Auth ইউজারের জন্য
আলাদাভাবে `.catch()` দিয়ে best-effort (একটা ডিলিটেড ইউজার বাকিদের ব্লক করে না), tenant
document-এর batch update ও audit log দুটোই একই batch-এ atomic। কিন্তু audit log ডকুমেন্টের ID
অটো-জেনারেটেড (`.doc()` কোনো আর্গুমেন্ট ছাড়া) — কোডবেসের অন্য জায়গায় প্রতিষ্ঠিত idempotency
কনভেনশনের বিপরীতে (যেমন `send-daily-notifications.mts`-এর deterministic
`todaysDelivery_{branchId}_{dateKey}` প্যাটার্ন, বা `retry-notification-deliveries.mts`-এর
`notifFailed_{deliveryDoc.id}`)।

**প্রভাব:** এই ফাংশনের দুটো ইনভোকেশন যদি কখনো ওভারল্যাপ করে (Netlify-এর ম্যানুয়াল রি-ট্রিগার,
বা শিডিউলার ডাবল-ফায়ার — বিরল কিন্তু অসম্ভব না), উভয়ই একই এক্সপায়ারিং tenant-কে তাদের নিজ নিজ
query snapshot-এ পাবে (কারণ প্রথমটার commit না হওয়া পর্যন্ত দ্বিতীয়টার query-ও একই tenant দেখবে),
এবং একই `tenant.trial_expired` ইভেন্টের জন্য **দুটো আলাদা audit_logs এন্ট্রি** তৈরি হবে। এটা ডেটা
করাপশন না (tenant document-এর নিজের আপডেট idempotent — দুবার একই ভ্যালু সেট হওয়া নিরাপদ, আর
`syncTenantUserClaims`-ও দুবার কল হলে একই Auth claim-ই আবার সেট হয়) — শুধু audit log-এ ডুপ্লিকেট
এন্ট্রি (লগ-ক্লাটার), গুরুত্বপূর্ণ কোনো ডেটা হারায় না বা ভুল দেখায় না।

**ফিক্স-দিক-নির্দেশনা:** audit log ref-কে deterministic বানান, যেমন
`doc.ref.collection("audit_logs").doc(\`trial_expired_${doc.id}\`)` (একই tenant দুবার এই একই
কারণে expire হবে না, তাই tenant ID-ভিত্তিক deterministic ID যথেষ্ট) — অন্য তিনটা ফাংশনের
প্যাটার্নের সাথে সামঞ্জস্যপূর্ণ করে।

---

### ইস্যু #৬ — `check-quotation-expiry.mts`-এ প্রকৃত রেস-কন্ডিশন: গ্রাহকের Accept/Reject silently ওভাররাইট হতে পারে
**সেভেরিটি: Medium** · **ফাইল:** `netlify/functions/check-quotation-expiry.mts`

এই ফাংশন প্রতিটা তেন্যান্টের জন্য `status in ["draft", "sent"]` ও `validUntil < now` — এই শর্তে
একটা query চালিয়ে, তারপর সেই snapshot-এর প্রতিটা ডকুমেন্টে **শর্তহীনভাবে** `batch.update(ref, {
status: "expired" })` করে — query আর commit-এর মাঝের সময়ে ডকুমেন্টের অবস্থা আবার re-check করা হয়
না।

**সমস্যা:** যদি ঠিক এই সময়ের মধ্যে (query snapshot নেওয়া থেকে batch.commit() পর্যন্ত) কোনো
কাস্টমার/স্টাফ ওই একই কোটেশন Accept বা Reject করেন (client থেকে সরাসরি
`status: "accepted"`/`"rejected"` লিখে), তাহলে এই ফাংশনের পরে-চলা `batch.commit()` সেই
সিদ্ধান্তকে **silently `"expired"`-এ ওভাররাইট করে দেবে** — Firestore batch write-এ কোনো
precondition/transaction-based re-check নেই যা আটকাতে পারতো। কাস্টমার হয়তো মনে করবেন তিনি
কোটেশন অ্যাকসেপ্ট করেছেন, কিন্তু ড্যাশবোর্ডে সেটা "মেয়াদোত্তীর্ণ" দেখাবে — বিভ্রান্তিকর, আর যদি
Accepted কোটেশন থেকে অর্ডার তৈরির ফ্লো (T-14) ইতিমধ্যে ট্রিগার হয়ে থাকে, তাহলে অর্ডার তৈরি হয়ে
গেলেও মূল কোটেশনটা "expired" দেখানো একটা ডেটা-ইনকনসিস্টেন্সি।

এই রেস উইন্ডো ছোট (একটা tenant-এর একটা batch-commit-এর সময়টুকু, সাধারণত মিলিসেকেন্ড থেকে
কয়েক সেকেন্ড) কিন্তু বাস্তব — প্রতিদিন একবার ঘটে, আর কোনো auto-retry/self-healing নেই (একবার
"expired" হয়ে গেলে গ্রাহকের সিদ্ধান্ত হারিয়েই যায়, tenant_admin-কে ম্যানুয়ালি স্ট্যাটাস ঠিক করতে
হবে)।

**ফিক্স-দিক-নির্দেশনা:** `generate-order-numbers.mts`-এর নিজস্ব প্যাটার্নই অনুসরণ করুন — batch-এর
বদলে প্রতিটা কোটেশনের জন্য আলাদা `db.runTransaction()` ব্যবহার করে, transaction-এর ভেতরে
কোটেশনটা fresh re-read করে `status` এখনো `"draft"`/`"sent"` আছে কিনা再-চেক করার পরই
`"expired"` লিখুন — যদি ততক্ষণে গ্রাহক Accept/Reject করে থাকেন, transaction সেটা দেখবে এবং
স্কিপ করবে। batch-এর তুলনায় বেশি Firestore অপারেশন লাগবে (per-doc transaction বনাম single
batch), কিন্তু কোটেশন সংখ্যা সাধারণত কম বলে ৩০-সেকেন্ড সীমার মধ্যেই থাকা উচিত।

---

### ইস্যু #৭ — `send-daily-notifications.mts`-এর "বকেয়া সতর্কতা" কোয়েরি সময়ের সাথে সাথে ক্রমশ ভারী হবে (নতুন স্কেলিং ঝুঁকি)
**সেভেরিটি: Low-Medium (এখন সমস্যা না, ক্রমবর্ধমান)** · **ফাইল:** `netlify/functions/send-daily-notifications.mts` (`overdueSnap` query)

এই ফাংশনের নিজস্ব কোড-কমেন্ট ইতিমধ্যে একটা স্কেলিং ঝুঁকি honestly ডকুমেন্ট করে রেখেছে:
"O(tenants × branches × 2 queries)" — tenant/branch সংখ্যা বাড়লে ৩০-সেকেন্ড সীমার ঝুঁকি। এই
সেশনের রিভিউতে **একটা দ্বিতীয়, ভিন্ন স্কেলিং অক্ষ** পাওয়া গেছে যেটা ওই কমেন্টে উল্লেখ নেই:

```javascript
const overdueSnap = await ordersRef
  .where("branchId", "==", branchId)
  .where("deletedAt", "==", null)
  .where("expectedDeliveryDate", "<", todayStartTs)
  .get();
```

এই query-তে **কোনো নিচের সীমা (lower bound) নেই** — অর্থাৎ প্রতিদিন, প্রতিটা শাখার জন্য, সেই
শাখার **শুরু থেকে আজ পর্যন্ত** সব "মেয়াদোত্তীর্ণ ডেলিভারি-তারিখের" অর্ডার fetch করে (তারপর
client-side filter করে delivered/cancelled/no-due বাদ দেয়)। একটা tenant যত পুরনো হবে, তত বেশি
পুরনো overdue-but-still-pending অর্ডার জমা হবে (এমনকি বছরের পর বছর ধরে), আর এই query-র read
কস্ট ও লেটেন্সি tenant/branch সংখ্যা স্থির থাকলেও **একাই ক্রমাগত বাড়তে থাকবে** — সময়ের সাথে সাথে
এই ফাংশন ধীরে ধীরে ৩০-সেকেন্ড সীমার কাছাকাছি চলে যাওয়ার একটা আলাদা, স্বাধীন পথ, যেটা ফাইলের
নিজস্ব ঝুঁকি-বিশ্লেষণে অনুপস্থিত।

**ফিক্স-দিক-নির্দেশনা:** query-তে একটা যুক্তিসঙ্গত নিচের সীমা যোগ করুন, যেমন
`.where("expectedDeliveryDate", ">", ninetyDaysAgoTs)` (৯০ বা ১৮০ দিন — tenant_admin-এর কাছে
৯০ দিনের বেশি পুরনো একটা বকেয়া অর্ডারের দৈনিক "সতর্কতা" এমনিতেও কার্যকরী মূল্য কম রাখে, আর তখনও
সেই অর্ডার orders তালিকায় ও রিপোর্টে থেকেই যাবে, শুধু দৈনিক নোটিফিকেশন কাউন্টে গণনা হবে না)। একই
composite index-এর সাথে সামঞ্জস্যপূর্ণ (একই ফিল্ডে দ্বিতীয় রেঞ্জ ক্লজ)।

---


## ৩. স্কোপ আইটেম #৫ — `functions/` ফোল্ডার সরানোর যোগ্যতা

✅ **নিশ্চিত: কোনো live path (`app/`, `lib/`, `netlify/`) `functions/`-কে import/reference করে না।**
`netlify.toml`-এর নিজস্ব কমেন্টেই এটা লেখা আছে এবং grep দিয়ে ক্রস-চেক করে নিশ্চিত হলো সত্যি।

⚠️ **তবে সরানোর আগে এই দুটো আপডেট প্রয়োজন**, নাহলে লোকাল emulator টেস্টিং ভেঙে যাবে:
1. `firebase.json`-এর `"functions": { "source": "functions", ... }` ব্লক এবং
   `"emulators": { "functions": { "port": 5001 }, ... }` — এন্ট্রি সরান/আপডেট করুন
2. `package.json`-এর `"emulators"` script: `firebase emulators:start --only auth,firestore,functions,storage`
   থেকে `functions` বাদ দিন (নাহলে `firebase.json`-এ referenced source না থাকলে এই স্ক্রিপ্ট ব্যর্থ হবে)

এরপর `functions/` ফোল্ডার সরানো নিরাপদ। (এটা ফিক্স না — শুধু "সরানোর আগে কী করতে হবে" তার চেকলিস্ট,
যেহেতু আপনার স্কোপ অনুযায়ী এই সেশনে কোনো কোড পরিবর্তন করা হচ্ছে না।)

---

## ৪. স্কোপ আইটেম #৬ — Netlify Scheduled Functions গভীর কোড-রিভিউ

| ফাইল | রিভিউ ফলাফল |
|---|---|
| `generate-order-numbers.mts` | ✅ **ক্লিন।** Concurrent-invocation নিরাপত্তা সঠিকভাবে বাস্তবায়িত — প্রতিটা অর্ডারের নম্বর-অ্যাসাইনমেন্ট একটা per-order transaction-এর ভেতরে, যেখানে transaction শুরুতেই fresh re-read করে `orderNumber` এখনো "OFFLINE-" দিয়ে শুরু কিনা চেক করে (double-assignment গার্ড)। কাউন্টার ইনক্রিমেন্টও একই transaction-এ atomic। ৩০-সেকেন্ড execution limit মাথায় রেখে ২০০-অর্ডার ব্যাচ ক্যাপ + পরের রানে বাকি অংশ তোলার ডিজাইনও সঠিক। |
| `hard-delete-expired-orders.mts` | ✅ **ক্লিন।** শুধু `orders`+`order_items` সাবকালেকশন হার্ড-ডিলিট করে; `payments`/`order_costings` (যেগুলো আলাদা top-level কালেকশন, orderId দিয়ে রেফারেন্স করে) কখনো স্পর্শ করে না — ব্লুপ্রিন্ট ১৩.১-এর "পেমেন্ট, কস্টিং ডেটা অক্ষত থাকবে" ঠিক এভাবেই বাস্তবায়িত। `deletedAt < cutoff` রেঞ্জ ফিল্টার স্বয়ংক্রিয়ভাবে `deletedAt == null` (কখনো ডিলিট হয়নি এমন) বাদ দেয় — সঠিক। |
| `check-trial-expiry.mts` | ⚠️ **একটা মাইনর ইস্যু (নিচে #৫)।** বাকি সব ঠিক — batch commit atomic, `syncTenantUserClaims` প্রতিটা Auth ইউজারের জন্য আলাদাভাবে `.catch()` দিয়ে best-effort (একটা ডিলিটেড ইউজার বাকিদের ব্লক করে না)। শুধু audit-log ডকুমেন্টের ID অটো-জেনারেটেড (deterministic না), যা concurrent-invocation-এ ডুপ্লিকেট লগ এন্ট্রি তৈরি করতে পারে (ডেটা-করাপশন না, শুধু লগ-ক্লাটার)। |
| `check-quotation-expiry.mts` | 🔴 **একটা প্রকৃত রেস-কন্ডিশন (নিচে #৬)।** কোটেশন Accept/Reject-এর সাথে race করলে ব্যবহারকারীর সিদ্ধান্ত silently "expired"-এ ওভাররাইট হয়ে যেতে পারে। |
| `retry-notification-deliveries.mts` | ✅ **মূলত ক্লিন।** Retry গণনা ব্লুপ্রিন্ট ১৩.৩-এর "সর্বোচ্চ ৩ বার" নীতির সাথে হুবহু মেলে (initial attempts:1 send-sms/send-email route-এ সেট হয়, তারপর প্রতি রিট্রাইয়ে +1, ৩-এ পৌঁছালে permanently failed — যাচাই করে নিশ্চিত হওয়া গেছে)। একটা তাত্ত্বিক (বাস্তবে প্রায় অসম্ভব) concurrent-invocation ডুপ্লিকেট-সেন্ড ঝুঁকি আছে — কোনো claim/lock মেকানিজম নেই — কিন্তু যেহেতু প্রতিটা রান ৩০ সেকেন্ডের মধ্যে শেষ হতে বাধ্য আর শিডিউল ৩০ মিনিট ব্যবধানে, স্বাভাবিক ওভারল্যাপ কার্যত অসম্ভব। শুধু তথ্যগত নোট, ইস্যু হিসেবে গণনা করা হয়নি। |
| `send-daily-notifications.mts` | ⚠️ **একটা নতুন পারফরম্যান্স/স্কেলিং ইস্যু (নিচে #৭), ধরন ভিন্ন যা কোডের নিজস্ব কমেন্টে ইতিমধ্যে স্বীকৃত ঝুঁকি থেকে।** Idempotency ঠিকই আছে — deterministic doc ID (`todaysDelivery_{branchId}_{dateKey}` / `dueAlert_{branchId}_{dateKey}`) দিয়ে একই দিনে পুনরায় চললে ওভাররাইট হয়, ডুপ্লিকেট হয় না। |



---

## ৫. স্কোপ আইটেম #৪ — Blueprint ফিচার ক্রস-চেক

### ৫.১ সাবস্ক্রিপশন ফিচার-গেটিং (অংশ ৪.৩) — ✅ মিলে যায়
`lib/server/plan-features.ts`-এর `DEFAULT_PLAN_FEATURES` টেবিল ব্লুপ্রিন্টের অংশ ৪.৩-এর প্রতিটা রো
(basic = সব premium-ফিচার false, standard = কস্ট ক্যালকুলেটর থেকে কাস্টম-ব্র্যান্ডিং পর্যন্ত সব
true কিন্তু SMS/Email/Export/Outsource/Portal/Priority false, premium = সব true) হুবহু মেলে।

### ৫.২ স্টাফ সীমা (৩/১০/সীমাহীন) — ✅ সঠিকভাবে enforce করা আছে
`lib/server/staff-helpers.ts`-এর `PLAN_STAFF_LIMITS` + `getPlanLimit()`/`countActiveStaff()` API
route-লেভেলে চেক করে, trial tenant-কে premium-সমতুল্য (কার্যত সীমাহীন) ট্রিট করে — ব্লুপ্রিন্ট
অংশ ৪.১-এর "Trial = সম্পূর্ণ সফটওয়্যার" নীতির সাথে সঙ্গতিপূর্ণ।

### ৫.৩ শাখা সীমা (১/৩/সীমাহীন) — ❌ enforce করা নেই → ইস্যু #২ (উপরে দেখুন)

### ৫.৪ Icon Mapping (অংশ ১৪.৭) / Emoji-শূন্য নীতি — ✅ নতুন কোডেও ক্লিন
Item variant ফিচারসহ (যেটা মূল ব্লুপ্রিন্টে ছিল না, পরে যোগ হয়েছে) পুরো `app/`+`components/`-এ
কোনো emoji character পাওয়া যায়নি এই সেশনের স্ক্যানে।

### ৫.৫ T-15–T-20 ফিচার-সম্পূর্ণতা (ফিল্ড/লজিক লেভেল) — ✅ সম্পূর্ণ যাচাই সম্পন্ন (৫ আগস্ট ২০২৬ আপডেট)
এই সেশনে সবগুলো মডিউল ব্লুপ্রিন্টের বিপরীতে ফিল্ড/লজিক লেভেলে যাচাই করা হয়েছে —
কোনো গ্যাপ পাওয়া যায়নি:

- **T-15 (Stock):** `StockItem`/`StockTransaction` টাইপ ব্লুপ্রিন্টের সব ফিল্ড
  কভার করে। "Dashboard-এ সতর্কতা" শর্তটা `stock/page.tsx`-এর নিজস্ব
  `LowStockAlert` কম্পোনেন্টে না — বরং অ্যাপ-ওয়াইড নোটিফিকেশন-বেল
  সিস্টেমে (`low_stock` notification type, `TrendingDown` আইকন, ব্লুপ্রিন্ট
  ১৪.৭-এর আইকন ম্যাপিং হুবহু মিলিয়ে) বাস্তবায়িত — যাচাই করে নিশ্চিত হওয়া
  গেছে এটা দুর্বলতা না, বরং সঠিক ডিজাইন (নোটিফিকেশন বেল সত্যিকারের
  dashboard-wide, শুধু স্টক পেজে সীমাবদ্ধ না)।
- **T-16 (Supplier):** নাম/যোগাযোগ/সরবরাহকৃত পণ্য/বর্তমান বাকি + ক্রয়-পেমেন্ট
  লেজার — সব মিলে যায়।
- **T-17 (Outsource):** ব্লুপ্রিন্টের সবগুলো ফিল্ড হুবহু মেলে, কোডেই একটা
  সুচিন্তিত ডিজাইন-সিদ্ধান্তের নোট আছে ("সংশ্লিষ্ট অর্ডার নম্বর" কেন
  free-text, foreign-key না)।
- **T-18 (Reports):** আর্থিক KPI, শাখাওয়ারি তুলনা, আইটেম/কাস্টমার/স্টাফ/খরচ
  বিশ্লেষণ — সব সেকশন বিদ্যমান। এক্সপোর্ট "Excel/PDF/CSV" ব্লুপ্রিন্ট-দাবির
  বিপরীতে শুধু CSV কোড দেখা যায় — কিন্তু `lib/utils/csv-export.ts`-এ
  ডকুমেন্টেড ইচ্ছাকৃত সিদ্ধান্ত: UTF-8 BOM-সহ CSV সরাসরি Excel-এ খোলে
  (নতুন dependency ছাড়াই), আর PDF সবজায়গায় `window.print()` দিয়ে
  (অ্যাপ-ওয়াইড কনভেনশন, চালান/ইনভয়েসেও একই প্যাটার্ন) — তাই এটা gap না,
  আগে থেকেই যুক্তিসহ নেওয়া একটা স্থাপত্যগত সিদ্ধান্ত।
- **T-19 (My Collection):** অর্ডার তালিকা/কস্টিং/পেমেন্ট এই পেজে, উত্তোলন
  একটা যুক্তিসঙ্গতভাবে পৃথক পেজে (`/dashboard/my-commission`) — উভয়ই
  স্টাফ-অ্যাক্সেসযোগ্য। ডেলিভারি চালান প্রিন্ট My Collection-এর অর্ডার
  তালিকা থেকে অর্ডার-ডিটেইল পেজে লিংক করে অ্যাক্সেসযোগ্য (আলাদা কোনো
  ডুপ্লিকেট প্রিন্ট-ভিউ দরকার নেই)।
- **T-20 (Customer Portal):** ট্র্যাকিং/টাইমলাইন/ইনভয়েস-ডাউনলোড সব আছে।
  "রিয়েলটাইম" `onSnapshot`-এর বদলে polling (`setInterval`) দিয়ে —
  কোডেই ডকুমেন্টেড কারণ (অথেনটিকেশন-বিহীন পাবলিক ইউজারকে সরাসরি Firestore
  listen অ্যাক্সেস দেওয়া নিরাপদ না)। ইনভয়েস ডাউনলোডও `window.print()`
  কনভেনশন অনুসরণ করে।

---

## ৬. স্কোপ আইটেম #২ (বাকি অংশ) — হার্ডকোডেড স্ট্রিং, ডেড লিংক

- **হার্ডকোডেড বাংলা/ইংরেজি JSX টেক্সট:** ফ্রেশ regex স্ক্যানে (`t()`-এর বাইরে সরাসরি JSX-এ বাংলা
  অক্ষর) **কোনো নতুন ইস্যু পাওয়া যায়নি।** যা মিলেছে তার সবই হয় প্লেসহোল্ডার em-dash (`—`, ফাঁকা
  ফিল্ড দেখানোর জন্য, translatable কনটেন্ট না) অথবা একটা কোড-কমেন্টের ভেতরের বাংলা টেক্সট
  (`tracking-qr-code.tsx`, ব্যবহারকারীর কাছে দৃশ্যমান না)।
- **ডেড/dangling লিংক (৫ আগস্ট ২০২৬ আপডেট):** ✅ **সম্পূর্ণ স্ক্যান সম্পন্ন, কোনো dead link পাওয়া
  যায়নি।** পুরো `app/`+`components/` জুড়ে চেক করা হয়েছে: sidebar nav কনফিগ (Tenant+Super Admin
  দুটোই), mobile bottom-nav ও more-menu (একই sidebar কনফিগ পুনর্ব্যবহার করে), সব
  `<Link href="...">`/`href={...}` লিটারেল ও টেমপ্লেট-লিটারেল, সব `router.push()` কল, আর সব
  Firestore notification ডকুমেন্টের `link` ফিল্ড (৫টা তৈরির-জায়গা: new-order, low-stock,
  daily-digest, order-number-ready, notification-retry-failed) — প্রতিটা `app/` route ফাইলের
  সাথে ক্রস-চেক করে মিলিয়ে দেখা হয়েছে। দুটো প্রাথমিকভাবে সন্দেহজনক ম্যাচ পাওয়া গেলেও দুটোই
  false positive: `/dashboard/menu` ও `` `/dashboard/orders/{orderId}` `` (ডলার-সাইন ছাড়া) —
  দুটোই আসলে JSDoc কমেন্টের ভেতরের প্রোজ টেক্সট (আগের একটা ফিক্সের বর্ণনা), লাইভ কোড না; আসল
  executable কোডে দুটোই সঠিক (`` `/dashboard/orders/${body.orderId}` ``)।
- **ব্রেকপয়েন্ট-গার্ডবিহীন fixed-width sidebar/panel:** `fixed left-0 top-0 h-screen` প্যাটার্নের
  জন্য grep স্ক্যানে **কোনো নতুন instance পাওয়া যায়নি** — আগের ফিক্স (SuperAdminSidebar) ধরে আছে।

---

## ৭. Cumulative সেভেরিটি সারাংশ

| # | ইস্যু | সেভেরিটি | স্ট্যাটাস |
|---|---|---|---|
| ১ | Staff raw-SDK দিয়ে payment ছাড়াই order dueAmount কমাতে পারে | **High** | ✅ ফিক্স হয়েছে (v26 ZIP, `getAfter()` rule) |
| ২ | `maxBranches` প্ল্যান-লিমিট কোথাও enforce হয় না | **Medium-High** | ✅ ফিক্স হয়েছে (v26 ZIP, নতুন Admin-SDK রুট) |
| ৩ | `orderIdPrefix` ডিফল্ট মান ড্যাশবিহীন, ব্লুপ্রিন্ট-উদাহরণের সাথে অমিল | **Low** | ✅ ফিক্স হয়েছে (v26 ZIP) |
| ৪ | ৩টা নতুন জায়গায় `overflow-x-auto` নেই (delivery-challan, quotation-print-view, zakat-distribution) | **Medium** | ✅ ফিক্স হয়েছে (v26 ZIP) |
| ৫ | `check-trial-expiry.mts`-এ audit-log ID deterministic না — concurrent-invocation-এ ডুপ্লিকেট লগ | **Low** | ✅ ফিক্স হয়েছে (v30 ZIP) |
| ৬ | `check-quotation-expiry.mts`-এ রেস-কন্ডিশন — Accept/Reject silently "expired"-এ ওভাররাইট হতে পারে | **Medium** | ✅ ফিক্স হয়েছে (v30 ZIP) |
| ৭ | `send-daily-notifications.mts`-এর overdue-query unbounded, সময়ের সাথে ক্রমশ ভারী হবে | **Low-Medium** | ✅ ফিক্স হয়েছে (v30 ZIP, ৯০-দিন window) |
| — | `npm run build` sandbox-এ যাচাই করা যায়নি (Google Fonts network block) | **Info** | environment limitation, unresolved |
| — | Firestore rules emulator-টেস্ট sandbox-এ চালানো যায়নি | **Info** | environment limitation, স্ট্যাটিক রিভিউ দিয়ে কভার করা হয়েছে |
| — | `functions/` ফোল্ডার সরানোর আগে `firebase.json`+`package.json` আপডেট দরকার | **Info** | checklist, কোনো bug না |

**যাচাই করে সম্পূর্ণ ক্লিন পাওয়া গেছে এই সেশনে (এবং ৫ আগস্টের সেশনে):** `tsc --noEmit`, `eslint`,
payments/audit_logs rules-এর ডকুমেন্টেড লজিক, `generate-order-numbers.mts` ও
`hard-delete-expired-orders.mts`-এর concurrency/referential-integrity,
`retry-notification-deliveries.mts`-এর retry-count লজিক (blueprint ১৩.৩ নীতির সাথে হুবহু মেলে),
`send-daily-notifications.mts`-এর idempotency (deterministic doc ID), plan-feature গেটিং টেবিল,
staff-limit enforcement, T-15–T-20 ব্লুপ্রিন্ট ক্রস-চেক (§৫.৫), emoji-শূন্য নীতি, হার্ডকোডেড-স্ট্রিং,
fixed-sidebar প্যাটার্ন, `functions/` ফোল্ডারে কোনো live reference নেই।

---

## ৮. যা কভার করা যায়নি (পরবর্তী সেশনের জন্য, ৫ আগস্ট ২০২৬ আপডেট)

1. ~~`check-trial-expiry.mts`, `check-quotation-expiry.mts`, `retry-notification-deliveries.mts`,
   `send-daily-notifications.mts`-এর গভীর লাইন-বাই-লাইন রিভিউ~~ ✅ সম্পন্ন (৫ আগস্ট ২০২৬, §৪+ইস্যু
   #৫–#৭ দেখুন) — ৩টা নতুন ইস্যু পাওয়া গেছে, এখনো ফিক্স করা হয়নি
2. ~~T-15–T-20-এর ফিল্ড/লজিক-লেভেল ব্লুপ্রিন্ট ক্রস-চেক~~ ✅ সম্পন্ন (৫ আগস্ট ২০২৬, §৫.৫ দেখুন)
3. ~~পুরো অ্যাপ জুড়ে dangling/dead link স্ক্যান~~ ✅ সম্পন্ন (৫ আগস্ট ২০২৬, §৬ দেখুন — কোনো dead link পাওয়া যায়নি)
4. বাস্তব ডিভাইস/ব্রাউজারে ৩৭৫px/৭৬৮px viewport visual verification (dev server চালিয়ে) — sandbox-এ ব্রাউজার/স্ক্রিনশট টুল নেই বলে এখনো করা যায়নি
5. `npm run build` প্রকৃত সাফল্য/ব্যর্থতা (network-unrestricted পরিবেশে)
6. Firestore emulator দিয়ে rules-এর বাস্তব positive/negative টেস্ট (ইস্যু #১ ও #৬-এর transaction/rules-ভিত্তিক ফিক্স অগ্রাধিকার)
