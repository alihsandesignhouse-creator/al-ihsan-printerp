# AUDIT-REPORT-3.md — Al-Ihsan PrintERP Free Edition

## ব্যাচ প্ল্যান (৬টি ব্যাচ)

| ব্যাচ | স্কোপ | স্ট্যাটাস |
|---|---|---|
| ব্যাচ ১ | Auth (login/signup) + Super Admin (dashboard, tenants, packages, reports, settings + সব super-admin কম্পোনেন্ট) + middleware.ts + api/auth + api/super-admin | ✅ সম্পন্ন |
| ব্যাচ ২ | Order + Payment + Customer কোর ফ্লো + api/staff + অর্ডার-সংশ্লিষ্ট api/notifications | ✅ সম্পন্ন |
| ব্যাচ ৩ | Costing + Quotation + Stock + Supplier + Outsource | ✅ সম্পন্ন |
| ব্যাচ ৪ | Commission + My-Commission + Expense + Reports + Zakat | ✅ সম্পন্ন |
| ব্যাচ ৫ | Settings + Profile + Users + Items + Audit-log + Pending-work + My-collection + Portal (tracking) + বাকি api routes | ✅ সম্পন্ন |
| **ব্যাচ ৬** | firestore.rules + storage.rules + firestore.indexes.json + i18n (bn/en) সম্পূর্ণ ক্রস-চেক + Cloud Functions (functions/src, ৭ ফাইল — যদিও Free Edition-এ deploy হয় না) | ✅ **এই সেশনে সম্পন্ন — অডিট সম্পূর্ণ** |

---

## ব্যাচ ১ — অডিট ফলাফল

প্রথমেই লক্ষণীয়: এই প্রজেক্টে আগেও একাধিক অডিট সেশন হয়ে গেছে — কোডে ছড়িয়ে থাকা "SECURITY FIX (audit item #N, ৩০/৩১ জুলাই ২০২৬)" কমেন্টগুলো (rate limiting, activate-tenant claims cascade, plan-feature live read ইত্যাদি) যাচাই করে দেখা গেছে যে এগুলো প্রকৃতপক্ষেই সঠিকভাবে ফিক্স করা আছে — এই ব্যাচে নতুন করে রিপোর্ট করা হয়নি। নিচের issue-গুলো নতুন, আগে ধরা পড়েনি এমন।

### Issue #1 — [Critical] "Enter Panel" (tenant impersonation) সম্পূর্ণ অকার্যকর — wiring gap

- **ফাইল:** `components/super-admin/TenantActionsMenu.tsx:46-48` এবং `app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx:135`
- **সমস্যা:** Super Admin কোনো tenant-এর "Enter Panel" (dropdown action) ক্লিক করলে শুধু `sessionStorage.setItem('impersonateTenantId', tenant.id)` করে `router.push('/dashboard')` কল হয়। কমেন্টে লেখা "middleware handles token swap" — কিন্তু `middleware.ts`-এ (পুরো ফাইল পড়ে দেখা হয়েছে) `impersonateTenantId`-এর কোনো রেফারেন্সই নেই, কোথাও এই key read হয় না (পুরো কোডবেসে grep করে শুধু এই দুই জায়গাতেই লেখা হচ্ছে, আর কোথাও পড়া হচ্ছে না)।
- **কেন সমস্যা:** এমনকি ধরেও নিলে ইউজার `/dashboard`-এ পৌঁছায়, `middleware.ts:80-83` অনুযায়ী `session.role === 'super_admin'` হলে `/dashboard`-এ যাওয়ার রিকোয়েস্টই সাথে সাথে `/super-admin/dashboard`-এ redirect হয়ে যাবে (কুকিতে role এখনও `super_admin`-ই থেকে যায়, impersonation-এর জন্য কোনো নতুন session/claim তৈরিই হয় না)। অর্থাৎ বাটনটা ক্লিক করলে কিছুই হয় না — ব্যবহারকারী নিজের ড্যাশবোর্ডেই ফেরত আসে, কোনো error/feedback ছাড়াই।
- **ফিক্স-দিক-নির্দেশনা:** হয় ফিচারটা সম্পূর্ণ বাস্তবায়ন করতে হবে (একটা প্রিভিলেজড API route যা সাময়িক custom-token/impersonation session ইস্যু করবে + middleware/layout-এ সেটা read করে tenant-scoped view দেখাবে), অথবা যদি Free Edition-এ এই ফিচার আউট-অফ-স্কোপ হয়, তাহলে UI থেকে "Enter Panel" আইটেমটা সরিয়ে ফেলতে হবে যতক্ষণ না backend সম্পন্ন হয়।

### Issue #2 — [High] `/forgot-password` লিংক আছে, পেজ নেই

- **ফাইল:** `app/(auth)/login/page.tsx:141` (লিংক), `middleware.ts:23` (public path হিসেবে allowlisted)
- **সমস্যা:** লগইন পেজে "পাসওয়ার্ড ভুলে গেছেন" লিংক `/forgot-password`-এ যায়, এবং middleware-ও এই path-কে public হিসেবে চিহ্নিত করেছে (তার মানে ডেভেলপার route-টা প্ল্যান করেছিলেন) — কিন্তু `app/(auth)/forgot-password/` ডিরেক্টরি/পেজ পুরো কোডবেসে কোথাও নেই (পুরো প্রজেক্ট grep করে নিশ্চিত করা হয়েছে)।
- **কেন সমস্যা:** যেকোনো ইউজার পাসওয়ার্ড ভুলে গেলে লিংকে ক্লিক করে 404-এ পড়বে — password-reset flow ব্যবহারযোগ্যই না। এটা একটা core auth flow-এর সম্পূর্ণ অনুপস্থিতি, শুধু UX পলিশ ইস্যু না।
- **ফিক্স-দিক-নির্দেশনা:** `app/(auth)/forgot-password/page.tsx` তৈরি করে Firebase Auth-এর `sendPasswordResetEmail` দিয়ে standard reset flow যোগ করতে হবে, অথবা যদি ইচ্ছাকৃতভাবে এখনো implement করা না হয়ে থাকে, লিংকটা সাময়িকভাবে সরিয়ে ফেলা উচিত (ভাঙা ফ্লো দেখানোর চেয়ে ভালো)।

### Issue #3 — [Medium] `printerp_session` কুকি client-এ forgeable — role-gating middleware এই কুকিকেই বিশ্বাস করে

- **ফাইল:** `lib/firebase/session.ts:21-30` (কুকি লেখা হয় `document.cookie =` দিয়ে, plain client-side JS, কোনো signature/httpOnly ছাড়া), `middleware.ts:32-47` (শুধু base64-decode করে trust করে, কোনো cryptographic verification নেই)
- **সমস্যা:** যেকোনো ব্যবহারকারী browser devtools থেকে `document.cookie` এডিট করে `role: "super_admin"`, `isActive: true` লিখে দিতে পারে — middleware তখন তাকে `/super-admin/*` route-এ ঢুকতে দেবে (page shell render হবে), অথবা suspended/trial-expired অবস্থা থেকে `/dashboard`-এ redirect বাইপাস করতে পারবে।
- **কেন সমস্যা:** `firestore.rules` real Firebase custom claims (`request.auth.token.role`, verified server-side দ্বারা Firebase নিজেই) ব্যবহার করে বলে **actual ডেটা এক্সপোজড হয় না** — কিন্তু UI shell/route এক্সেস একটা নিরাপত্তা স্তর হিসেবে কাজ করছে না, যা মিডলওয়্যারের নিজের কমেন্টেই "first, fast layer of protection" বলা হয়েছে বলে স্পষ্টভাবেই একটা প্রকৃত নিরাপত্তা উদ্দেশ্য বহন করে। এছাড়া, `MODULE_README.md`-এর মূল নোট (লাইন ৪০) বলে কুকিটা "set server-side at login" হওয়া উচিত ছিল — কিন্তু বাস্তব ইমপ্লিমেন্টেশন সম্পূর্ণ client-side, যা ডিজাইন-উদ্দেশ্যের সাথে অসামঞ্জস্যপূর্ণ।
- **ফিক্স-দিক-নির্দেশনা:** হয় কুকিটাকে server-side (route handler/Server Action-এ, HttpOnly + signed/HMAC) সেট করতে হবে, অথবা কমপক্ষে MODULE_README/middleware-এর কমেন্টে স্পষ্ট করে লিখতে হবে যে এই ফরজেবিলিটি একটা জ্ঞাত, গ্রহণযোগ্য trade-off (কারণ real security Firestore rules-এ, শুধু data-loss/leak হচ্ছে না) — বর্তমানে কমেন্ট এটাকে "fast layer of protection" বলে দাবি করছে যা বিভ্রান্তিকর কারণ এটা আসলে কোনো protection দেয় না, স্প্যুফ করা সহজ।

### যা যাচাই করে ক্লিন পাওয়া গেছে (false positive এড়াতে উল্লেখ)

- **i18n key parity:** `messages/bn.json` ও `messages/en.json`-এ পুরো প্রজেক্ট জুড়ে ঠিক ১৩৮১টি key, দুই ফাইলেই হুবহু মিলে যায় — কোনো drift নেই।
- **হার্ডকোডেড স্ট্রিং:** `app/(auth)`, `app/(super-admin)`, `components/super-admin` — এই পুরো ব্যাচে কোনো raw বাংলা/ইংরেজি স্ট্রিং সরাসরি JSX-এ পাওয়া যায়নি (সব `t()` দিয়ে)।
- **`console.log`/`any`/emoji:** ব্যাচ ১-এর কোনো ফাইলে production-leak console.log, `any` টাইপ, বা emoji পাওয়া যায়নি।
- **`api/super-admin/create-tenant`, `activate-tenant`, `sync-tenant-claims`, `api/auth/signup`:** সবগুলো server-side Bearer token verify করে (কখনও client-claimed role trust করে না), rate-limited (signup route), এবং zod দিয়ে সঠিকভাবে ভ্যালিডেটেড — এইগুলো ভালোভাবে করা।
- একটা মিসলিডিং automated i18n "missing key" স্ক্যান (namespace-aware না হওয়ায়) প্রথমে ২৮৭টা false positive দিয়েছিল — namespace-scope ঠিক করে re-check করার পর প্রায় সবই false positive প্রমাণিত হয়েছে (multi-component ফাইলে একাধিক `useTranslations()` কল থাকায়), তাই রিপোর্টে অন্তর্ভুক্ত করা হয়নি। এই স্ক্রিপ্ট-ভিত্তিক পদ্ধতি scope-aware না হওয়ায় ব্যাচ ৬-এ (পুরো প্রজেক্ট i18n ক্রস-চেক) এটা AST-ভিত্তিক টুল দিয়ে বা প্রতিটা ফাইল ম্যানুয়ালি পড়ে পুনরায় করা দরকার — automated grep যথেষ্ট নির্ভরযোগ্য না।

### সারসংক্ষেপ — ব্যাচ ১

**Critical: 1, High: 1, Medium: 1, Low: 0** (মোট ৩টা নতুন issue)

---

## ব্যাচ ২ — অডিট ফলাফল

### Issue #4 — [Medium] পেমেন্ট amount অর্ডারের dueAmount-এর সাথে সীমাবদ্ধ নয় — client-এও না, Firestore rules-এও না

- **ফাইল:** `lib/firebase/orders.ts:584` (`recordPayment`-এ `newDue = round2(order.dueAmount - input.amount)` — কোনো clamp/cap নেই), `components/tenant/orders/payment-modal.tsx` (amount input শুধু positive চেক করে, `currentDue`-এর সাথে তুলনা করে না), `lib/validations/order.ts:75-81` (`recordPaymentSchema`-তে শুধু `.positive()`, কোনো `.max(dueAmount)` সম্ভবই না কারণ static schema-তে dynamic due জানা যায় না — কিন্তু runtime-এ ফর্ম লেভেলেও চেক নেই), `firestore.rules:209-217` (payments-এর `create` rule শুধু `amount > 0` চেক করে, order-এর dueAmount-এর সাথে সম্পর্ক verify করে না) এবং `firestore.rules:190-191` (order-এর staff-branch update rule শুধু `dueAmount <= resource.data.dueAmount` (কমছে কিনা) চেক করে — কতটা কমলো, payment.amount-এর সাথে মিলছে কিনা তা কখনোই verify করে না)।
- **কেন সমস্যা:** দুইটা আলাদা সমস্যা একসাথে —
  1. **UX/ডেটা bug:** কোনো স্টাফ ভুলবশত due-এর চেয়ে বেশি amount টাইপ করলে (যেমন ৳৫০০ due-তে ৳৫০০০ লিখে ফেললে), `dueAmount` নেগেটিভ হয়ে যাবে — কোনো error/warning ছাড়াই সেভ হবে, এবং due-amount-ভিত্তিক রিপোর্ট/রিসিট/কালেকশন-তালিকায় এই নেগেটিভ ভ্যালু কীভাবে দেখানো হবে তা কোথাও হ্যান্ডেল করা নেই।
  2. **নিরাপত্তা/ইন্টিগ্রিটি gap:** যেহেতু `payments/{paymentId}` (create) আর `orders/{orderId}` (update)-এর rules একে অপরের থেকে স্বতন্ত্রভাবে evaluate হয়, raw Firestore SDK access থাকা একজন authenticated staff/tenant_admin ইচ্ছাকৃতভাবে একটা বড় amount-এর payment রেকর্ড লিখে দিয়ে order-এর dueAmount সামান্যই কমাতে পারবে (অথবা উল্টোটা) — অ্যাপের নিজস্ব UI flow দিয়ে না গিয়ে। Rules-এর কমেন্টে "পেমেন্ট সবসময় যোগ হবে, replace নয়" নীতির উল্লেখ থাকলেও, payment amount আর dueAmount-হ্রাসের মধ্যে সাংখ্যিক সংগতি কোথাও enforce হয় না।
- **ফিক্স-দিক-নির্দেশনা:** (ক) `payment-modal.tsx`-এ client-side একটা soft warning/confirm যোগ করা যায় যখন amount > currentDue ("due-এর চেয়ে বেশি, এগিয়ে যাবেন?")। (খ) আরও গুরুত্বপূর্ণ, security-rules লেভেলে একটা constraint যোগ করা — যেমন `orders` update rule-এ `resource.data.dueAmount - request.resource.data.dueAmount` কে সংশ্লিষ্ট payment write-এর amount-এর সাথে মেলানো কঠিন (দুই ডকুমেন্ট আলাদা rule-এ), তাই বাস্তবসম্মত ফিক্স হলো এই পুরো অপারেশনটাকে (payment create + order dueAmount update) একটা privileged server route (Admin SDK, `runTransaction`) দিয়ে করা, ঠিক `activate-tenant`-এর মতো প্যাটার্নে — client-side transaction + independent security rules এর বদলে।

### যা যাচাই করে ক্লিন পাওয়া গেছে (false positive এড়াতে উল্লেখ)

- **Soft-delete প্যাটার্ন:** orders, customers — দুই জায়গাতেই সমান `deletedAt`/`deletedBy` কনভেনশন, সব read query-তে `where("deletedAt","==",null)` সামঞ্জস্যপূর্ণভাবে প্রয়োগ করা।
- **Firestore rules — order billing-field ফ্রিজ (staff):** `firestore.rules:157-204` যাচাই করে দেখা গেছে staff শুধু `{status, dueAmount (শুধু কমার দিকে), updatedAt}`-ই এডিট করতে পারে, বাকি সব billing field ফ্রিজড — এটা আগের অডিটে ধরা পড়া বাগের সঠিক ফিক্স, এখনো অক্ষত।
- **Firestore indexes:** `subscribeToOrders`/`subscribeToTenantPayments`-এর প্রতিটা query shape (deletedAt+branchId+expectedDeliveryDate/createdAt কম্বিনেশন) `firestore.indexes.json`-এ ঠিক মিলে যায় — কোনো missing composite index পাওয়া যায়নি।
- **Wiring:** `ReassignStaffModal`, `CustomerPicker`, `PaymentModal`, `DeliveryChallan` — সবগুলো কম্পোনেন্ট প্রকৃতপক্ষে import/render হচ্ছে, orphaned/dead কম্পোনেন্ট পাওয়া যায়নি এই ব্যাচে।
- **`api/staff/create`, `api/staff/update`, `api/staff/set-status`:** সবগুলো `requireTenantAdmin`-এর মাধ্যমে server-side verified ID token + role check করে, orphaned Auth user rollback লজিকসহ (create route) — well-built।
- **i18n/console/any/emoji:** batch ২-এর কোনো ফাইলে হার্ডকোডেড স্ট্রিং, unguarded console.log, `any`, বা emoji পাওয়া যায়নি।

### সারসংক্ষেপ — ব্যাচ ১ + ব্যাচ ২ (ক্রমযোজিত)

**Critical: 1, High: 1, Medium: 2, Low: 0** (মোট ৪টা issue)

---

## ব্যাচ ৩ — অডিট ফলাফল

এই ব্যাচে কোনো নতুন Critical/High/Medium issue পাওয়া যায়নি — এই মডিউলগুলো তুলনামূলক ভালোভাবে তৈরি, এবং আগে পাওয়া দুইটা নামকরা বাগ প্যাটার্ন (`outsourceTracking` standardPlus ভুল গেটিং, এবং nested-field-stripping zod বাগ) নির্দিষ্টভাবে যাচাই করে দুটোই সঠিকভাবে ফিক্সড/অনুপস্থিত পাওয়া গেছে (নিচে বিস্তারিত)।

### যা যাচাই করে ক্লিন পাওয়া গেছে (false positive এড়াতে উল্লেখ)

- **`outsourceTracking` plan-gating (আগে জানা বাগ, পুনরায় চেক করা হয়েছে):** `lib/server/plan-features.ts`-এ `outsourceTracking` শুধু premium প্ল্যানে `true` (basic/standard-এ `false`), `app/(tenant)/dashboard/outsource/page.tsx:29`-এর কমেন্টেও স্পষ্ট লেখা "premium-only (standardPlus নয়)", আর সাইডবার (`components/tenant/layout/sidebar.tsx:79`)-ও `featureKey: "outsourceTracking"` দিয়ে গেট করা — পুরোনো ভুল heuristic-টা আর নেই।
- **Nested-field zod-stripping বাগ (আগে order.ts-এ পাওয়া, এখানে চেক করা হয়েছে অন্য কোথাও আছে কিনা):** `quotationItemRowSchema` (`lib/validations/quotation.ts`)-এ `selectedAttributes` ফিল্ড নেই — কিন্তু যাচাই করে দেখা গেছে quotation item rows কম্পোনেন্টে (`quotation-item-rows.tsx`, `quotation-form.tsx`) attribute-selection ফিচারটাই নেই, তাই এটা বাদ পড়া কোনো বাগ না, ইচ্ছাকৃত স্কোপ-পার্থক্য।
- **`order_costings` role-ভিত্তিক অ্যাক্সেস:** `firestore.rules:436-451` (commission_staff শুধু নিজের `takenByStaffId`-এর অর্ডারে costing লিখতে পারে) হুবহু মেলে `app/(tenant)/dashboard/orders/[orderId]/page.tsx:302`-এর `canEdit` লজিকের সাথে (UI role-gating = rules role-gating, checklist G অনুযায়ী সামঞ্জস্যপূর্ণ)। এটা সাইডবারের `/dashboard/costing` (calculator/template টুল, admin+branch_manager-only) থেকে আলাদা একটা ফিচার — অর্ডার-ডিটেইল পেজে embed করা costing entry — তাই commission_staff সাইডবারে "Costing" লিংক না দেখলেও তাদের নিজের অর্ডারে costing দেওয়ার পথ আসলে আছে, ভাঙা না।
- **Stock quantity integrity:** `lib/firebase/stock.ts:180-182`-এ `recordStockTransaction` স্পষ্টভাবে `newStock < 0` হলে throw করে (order payments-এর মতো unbounded না) — এবং rules-এও stock_items/stock_transactions write শুধু `isTenantAdmin() || isBranchManager()`-এর জন্য সীমাবদ্ধ (regular/commission staff লিখতেই পারে না), তাই ব্যাচ ২-তে পাওয়া payment-amount-cap সমস্যাটার মতো ঝুঁকি এখানে নেই।
- **Supplier ledger `currentDue` নেগেটিভ হওয়া:** `lib/firebase/suppliers.ts:140`-এর কমেন্টে স্পষ্ট লেখা এটা ইচ্ছাকৃত ("may go negative, meaning [advance to supplier]") — bug না, ডকুমেন্টেড ডিজাইন সিদ্ধান্ত।
- **Wiring:** `/dashboard/quotations/new` পেজ, outsource/stock/supplier সব সাবপেজ ও মডাল properly import/render হচ্ছে — কোনো orphaned কম্পোনেন্ট বা ভাঙা সাইডবার লিংক পাওয়া যায়নি এই ব্যাচে।

### সারসংক্ষেপ — ব্যাচ ১+২+৩ (ক্রমযোজিত)

**Critical: 1, High: 1, Medium: 2, Low: 0** (মোট ৪টা issue — ব্যাচ ৩-এ নতুন কিছু যোগ হয়নি)

---

## ব্যাচ ৪ — অডিট ফলাফল

### Issue #5 — [Medium] CSV এক্সপোর্টে formula/CSV-injection sanitization নেই

- **ফাইল:** `lib/utils/csv-export.ts:10-14` (`escapeCsvCell` শুধু `"`, `,`, newline এস্কেপ করে — সেল-ভ্যালু `=`, `+`, `-`, বা `@` দিয়ে শুরু হলে তা সরানো/prefix করা হয় না), যা `components/tenant/reports/export-csv-button.tsx:126` (রিপোর্টের `itemName`, `staffName`, `branchName` কলাম) এবং `components/shared/csv-export-button.tsx:51` (সাধারণ list-export বাটন, orders/customers ইত্যাদি তালিকায় ব্যবহৃত — কাস্টমার নাম, নোট, আইটেম নাম-সহ আরও সরাসরি ইউজার-টাইপড ফিল্ড) — উভয় জায়গাতেই ব্যবহৃত হয়।
- **কেন সমস্যা:** এটা একটা পরিচিত ভালনারেবিলিটি ক্লাস (CSV/Formula Injection, CWE-1236)। `itemName`-এর মতো ফিল্ড staff স্বাধীনভাবে টাইপ করে (schema শুধু length/non-empty চেক করে, কোনো character restriction নেই — `lib/validations/order.ts:25`)। কেউ ইচ্ছাকৃতভাবে বা ভুলবশত আইটেমের নাম `=...` বা `+...` দিয়ে শুরু করলে, পরে কোনো tenant_admin সেই ডেটা CSV এক্সপোর্ট করে Excel/Google Sheets/LibreOffice-এ খুললে সেই সেলটা ফর্মুলা হিসেবে evaluate হতে পারে — data-exfiltration লিংক (`=HYPERLINK(...)`) বা (পুরনো Excel সেটিংসে) কমান্ড এক্সিকিউশন পর্যন্ত সম্ভব।
- **ফিক্স-দিক-নির্দেশনা:** `escapeCsvCell`-এ, `"`/`,`/newline এস্কেপ করার আগে চেক করা — সেল-ভ্যালুর প্রথম অক্ষর `=`, `+`, `-`, `@`, ট্যাব, বা CR হলে সামনে একটা সিঙ্গেল-কোট (`'`) prefix জুড়ে দেওয়া (স্ট্যান্ডার্ড OWASP মিটিগেশন) — যাতে স্প্রেডশিট সফটওয়্যার সেটাকে টেক্সট হিসেবে ট্রিট করে, ফর্মুলা হিসেবে না।

### যা যাচাই করে ক্লিন পাওয়া গেছে (false positive এড়াতে উল্লেখ)

- **Withdrawal amount-cap:** `requestWithdrawal()`-এ (`lib/firebase/commission.ts`) স্টাফ যেকোনো amount রিকোয়েস্ট করতে পারে, `withdrawal-request-dialog.tsx`-তেও available-balance-এর সাথে ক্যাপ করা নেই — কিন্তু এটা batch ২-এর payment issue-এর মতো বাগ না, কারণ এটা শুধু একটা `status:"pending"` রিকোয়েস্ট তৈরি করে; `processWithdrawal()`-এ admin/branch_manager amount দেখে/এডিট করে তারপর approve করেন (`editedByAdmin` ফ্ল্যাগসহ) — human-in-the-loop review ধাপ আছে বলে সরাসরি অসংগত ডেটা লেখা হয় না।
- **`processWithdrawal` atomic expense creation:** approve হলে একই transaction-এ `expenses` কালেকশনে "স্টাফ পেমেন্ট" এন্ট্রি তৈরি হয় (`sourceWithdrawalId` লিংকসহ) — atomic, ধারাবাহিক।
- **Firestore composite indexes (commission/expenses):** `subscribeOrdersForCommission`/`subscribeOrderCostingsMap`/expenses-এর query shape-গুলো বিদ্যমান index পুনর্ব্যবহার করে বলে কমেন্টে উল্লেখ আছে, এবং যাচাই করে তা সঠিক পাওয়া গেছে — নতুন কোনো missing-index সমস্যা নেই।
- **i18n/console/any/emoji:** batch ৪-এর কোনো ফাইলে হার্ডকোডেড স্ট্রিং, unguarded console.log, `any`, বা emoji পাওয়া যায়নি।

### সারসংক্ষেপ — ব্যাচ ১+২+৩+৪ (ক্রমযোজিত)

**Critical: 1, High: 1, Medium: 3, Low: 0** (মোট ৫টা issue)

---

## ব্যাচ ৫ — অডিট ফলাফল

### Issue #6 — [Medium] `audit_logs` কালেকশনের `create` rule-এ `userId`/কন্টেন্ট ভেরিফাই হয় না — যেকোনো active user নকল এন্ট্রি লিখতে পারে

- **ফাইল:** `firestore.rules:264-271` (`match /tenants/{tenantId}/audit_logs/{logId}` — `allow create: if belongsToTenant(tenantId) && isActiveUser(tenantId);` — এখানে `request.resource.data.userId == request.auth.uid` জাতীয় কোনো ফিল্ড-লেভেল চেক নেই), `lib/firebase/audit.ts` (অ্যাপ নিজে সবসময় সঠিক `userId` দিয়ে লেখে — কিন্তু এটা শুধু client-code convention, rules-এ enforced না)
- **কেন সমস্যা:** Audit log-এর উদ্দেশ্যই হলো tamper-evident ট্রেইল রাখা যাতে admin পরে কার কাজ যাচাই করতে পারেন। যেহেতু rules-এ কোনো field-level constraint নেই, raw Firestore SDK অ্যাক্সেস থাকা যেকোনো active (এমনকি regular_staff) ব্যবহারকারী স্বেচ্ছায় ভুয়া `userId`/`action`/`details` দিয়ে একটা `audit_logs` ডকুমেন্ট লিখে দিতে পারে — যেমন নিজের করা কোনো কাজ অন্য একজন স্টাফের নামে চালিয়ে দেওয়া, অথবা fake entries দিয়ে audit log spam/flood করে আসল এন্ট্রি খুঁজে পাওয়া কঠিন করে দেওয়া। `allow update, delete: if false` থাকায় অন্তত একবার লেখা এন্ট্রি এডিট/মুছে ফেলা যায় না, কিন্তু create-টাইমেই স্পুফিং সম্ভব।
- **ফিক্স-দিক-নির্দেশনা:** `create` rule-এ `request.resource.data.userId == request.auth.uid` (এবং সম্ভব হলে `action` একটা enum/whitelist-এর অন্তর্গত কিনা) যোগ করা — যাতে কেউ নিজের uid ছাড়া অন্য কারো নামে এন্ট্রি লিখতে না পারে। `auth.login`/`auth.logout` ইভেন্টের মতো যেগুলো সত্যিকারের server-verification দরকার (IP/device স্পুফ-প্রতিরোধী করতে), সেগুলো ভবিষ্যতে Admin SDK route-এ সরানো যেতে পারে, তবে এই মুহূর্তে ন্যূনতম ফিক্স হলো `userId` ম্যাচ enforcement।

### যা যাচাই করে ক্লিন পাওয়া গেছে (false positive এড়াতে উল্লেখ)

- **`/api/portal/track` (পাবলিক, no-auth ট্র্যাকিং রুট):** পুরোপুরি পড়া হয়েছে — order number + ফোন নম্বর দুটোই মিলতে হয়, ভুল হলে identical generic "not found" (phone-enumeration প্রতিরোধ), IP + (tenantId, orderNumber) দুই স্তরে rate-limited, tenant `isActive`/`customerPortal` ফিচার-ফ্ল্যাগ চেক করা — আগের অডিটে ধরা পড়া রেট-লিমিট বাগ (audit item #2) সঠিকভাবে ফিক্সড।
- **স্টাফ-সংখ্যা প্ল্যান-লিমিট (checklist H):** ক্লায়েন্ট-সাইড `StaffLimitBanner` তথ্যমূলক মাত্র, কিন্তু `app/api/staff/create/route.ts`-এ সার্ভার-সাইডে `getPlanLimit()` দিয়ে `activeCount >= limit` সঠিকভাবে enforce হয় — bypass সম্ভব না।
- **Password change ফ্লো:** `ChangePasswordForm`/`changeOwnPassword` Firebase Auth-এর প্রকৃত reauthentication ব্যবহার করে, ভুল current-password/weak-password/reauth-required — প্রতিটা এরর কেসই আলাদাভাবে ম্যাপ করা।
- **Item soft-delete:** `softDeleteItem` কনফার্ম-ডায়ালগসহ (destructive flag) — item master শুধু রেফারেন্স তালিকা, অর্ডার তৈরির সময় ডেটা কপি হয়ে যায় বলে পুরনো অর্ডারে delete-এর প্রভাব পড়ে না।
- **Pending-work Kanban vs Table vs Cards — সিঙ্গেল সোর্স অফ ট্রুথ:** তিনটা ভিউই read-only (`subscribeToOrders` দিয়ে render), স্ট্যাটাস পরিবর্তনের কোনো ডুপ্লিকেট লজিক নেই — `order-detail-modal.tsx` শুধু প্রিভিউ দেখায়, এডিটের জন্য `/dashboard/orders/{id}`-এ লিংক করে। Kanban/Table view-এর মধ্যে ডেটা ড্রিফট হওয়ার ঝুঁকি নেই।
- **Audit-log পেজ role-gating:** `app/(tenant)/dashboard/audit-log/page.tsx` (page guard), sidebar (`roles: ["tenant_admin"]`), আর rules (`isTenantAdmin() || resource.data.userId == request.auth.uid` — নিজের এন্ট্রি বাদে বাকি সব শুধু admin) — তিন স্তরেই সামঞ্জস্যপূর্ণ (উপরের Issue #6 বাদে)।
- **i18n/console/any/emoji:** batch ৫-এর কোনো ফাইলে হার্ডকোডেড স্ট্রিং, unguarded console.log, `any`, বা emoji পাওয়া যায়নি।

### সারসংক্ষেপ — ব্যাচ ১+২+৩+৪+৫ (ক্রমযোজিত)

**Critical: 1, High: 1, Medium: 4, Low: 0** (মোট ৬টা issue)

---

## ব্যাচ ৬ — অডিট ফলাফল (শেষ ব্যাচ)

এই ব্যাচে কোনো নতুন issue পাওয়া যায়নি। দুইটা সন্দেহজনক পয়েন্ট তদন্ত করে দুটোই ইতিমধ্যে সচেতনভাবে ডকুমেন্টেড/সমাধানকৃত পাওয়া গেছে (নিচে বিস্তারিত) — এটা একটা ভালো লক্ষণ যে MODULE_README.md-এর দাবিগুলো এবার সত্যিই কোডের সাথে মেলে।

### তদন্ত করা সন্দেহজনক পয়েন্ট (উভয়ই false positive হিসেবে বাতিল, ডকুমেন্টেশন + কোড উভয় দিয়ে ক্রস-চেক করে)

- **`storage.rules`-এর `/tenants/{tenantId}/logo/{filename}` পাথ ব্যবহারই হয় না:** পুরো কোডবেসে কোথাও `firebase/storage` SDK ইম্পোর্ট নেই (grep করে নিশ্চিত) — `uploadTenantLogo()` (`lib/firebase/tenant-settings.ts`) আসলে Cloudinary ব্যবহার করে, Firebase Storage না (কারণ: Cloud Storage-এ আপলোডের জন্য Blaze প্ল্যান লাগে, Free Edition Spark-প্ল্যান-ভিত্তিক)। প্রথমে মনে হয়েছিল এটা পাবলিক পোর্টালে লোগো ভাঙার একটা বাগ হতে পারে (যেহেতু rules-এ `request.auth != null` লাগে, কিন্তু পোর্টাল অ্যানোনিমাস) — কিন্তু যাচাই করে দেখা গেছে পোর্টাল Cloudinary-র পাবলিক URL সরাসরি রেন্ডার করে, Firebase Storage-এর সাথে সম্পর্কই নেই। `MODULE_README.md:1193`-এ এটা স্পষ্টভাবে "ইচ্ছাকৃতভাবে রাখা হয়েছে... harmless" হিসেবে ডকুমেন্টেড। **নতুন issue না।**
- **`functions/src/portalFunctions.ts`-এ rate-limiting নেই (active রুটের বিপরীতে):** প্রথমে মনে হয়েছিল এটা একটা রিগ্রেশন ঝুঁকি — কিন্তু `MODULE_README.md`-এর "Free Edition — Phase F1" সেকশন অনুযায়ী পুরো `functions/` ফোল্ডারটাই এখন শুধু **রেফারেন্স/মাইগ্রেশন-সোর্স** হিসেবে রাখা আছে (deploy হয় না, Spark প্ল্যানে deploy করাই যায় না), ইচ্ছাকৃতভাবে অপরিবর্তিত রাখা হয়েছে যতক্ষণ না সব Migration Map আইটেম migrate সম্পূর্ণ হয় (তখন পুরো ফোল্ডার একসাথে সরানো হবে)। Live/active কোড path (`app/api/portal/track/route.ts`) ইতিমধ্যে rate-limited। **নতুন issue না।**
- **অর্ডার-নম্বর জেনারেশন (`generateOrderNumber` Cloud Function trigger) migrate হয়েছে কিনা:** `lib/firebase/orders.ts`-এর কমেন্টে "OFFLINE-{timestamp}" টেম্পোরারি নম্বরের উল্লেখ দেখে সন্দেহ হয়েছিল Free Edition-এ এটা কখনো প্রকৃত sequential নম্বরে বদলায় কিনা (যেহেতু মূল মেকানিজম ছিল একটা Firestore trigger Cloud Function, আর Free Edition Cloud Function deploy করতে পারে না)। যাচাই করে দেখা গেছে `netlify/functions/generate-order-numbers.mts` (এবং `generate-quotation-numbers.mts`) এই ঠিক এই কাজটাই করে — একটা scheduled polling pattern (collection-group range query দিয়ে "OFFLINE-" prefix-ওয়ালা অর্ডার খুঁজে বের করে transaction-এর ভেতর sequential নম্বর বসায়), সংশ্লিষ্ট `firestore.indexes.json`-এর `fieldOverrides` (COLLECTION_GROUP scope) সহ সঠিকভাবে কনফিগার করা আছে। **নতুন issue না — সম্পূর্ণভাবে migrate করা আছে।**

### যা যাচাই করে ক্লিন পাওয়া গেছে

- **i18n সম্পূর্ণতা (namespace-aware, প্রজেক্ট-ব্যাপী):** `app/`, `components/`, `lib/`-এর প্রতিটা `.ts(x)` ফাইলে প্রতিটা `useTranslations()` ভ্যারিয়েবলের namespace ঠিকভাবে ট্র্যাক করে মোট **১৬৩৩টা `t()` কল** `bn.json`-এর বিপরীতে যাচাই করা হয়েছে — **একটাও missing key পাওয়া যায়নি**। (ব্যাচ ১-এর naive/non-namespace-aware স্ক্রিপ্ট যে ২৮৭টা false positive দিয়েছিল তার প্রায় সবই এই সঠিক পদ্ধতিতে বাতিল হয়ে গেছে — যেমন ধারণা করা হয়েছিল)।
- **`bn.json`/`en.json` key parity:** ১৩৮১টা key, দুই ফাইলেই হুবহু মেলে (ব্যাচ ১-এ যাচাই করা, পুনর্নিশ্চিত)।
- **হার্ডকোডেড স্ট্রিং (প্রজেক্ট-ব্যাপী JSX স্ক্যান):** পুরো `app/`+`components/`-এ JSX ট্যাগের মধ্যে সরাসরি বাংলা টেক্সট মাত্র একটা জায়গায় পাওয়া গেছে — `components/tenant/orders/order-form.tsx:374`-এ `<option value="amount">৳</option>` — এটা টাকার প্রতীক (currency symbol), অনুবাদযোগ্য UI টেক্সট না, তাই হার্ডকোড করা সঠিক। বাস্তবে কোনো hardcoded-string সমস্যা নেই।
- **`firestore.indexes.json`:** batch ১-৫-এ প্রতিটা module-এর query pattern-এর বিপরীতে ইতিমধ্যে ক্রস-চেক করা হয়েছে, এবং এই ব্যাচে collection-group `orderNumber`/`quotationNumber` override-ও নিশ্চিত করা হলো — কোনো missing index পাওয়া যায়নি।
- **firestore.rules (সামগ্রিক পুনর্বিবেচনা):** পুরো ৬৬৫ লাইন — batch ১-৫ জুড়ে টুকরো টুকরো করে ইতিমধ্যে যাচাই করা প্রতিটা কালেকশনের rule (orders, payments, stock, suppliers, outsource, order_costings, audit_logs ব্যতীত) বাস্তব read/write প্যাটার্নের সাথে মেলে — নতুন কোনো মিসিং rule/collection পাওয়া যায়নি এই চূড়ান্ত রিভিউতেও।

### সারসংক্ষেপ — সবগুলো ব্যাচ (চূড়ান্ত)

**Critical: 1, High: 1, Medium: 4, Low: 0 — মোট ৬টা issue**, ৬টা ব্যাচ, পুরো কোডবেস কভার করা হয়েছে।

---

## চূড়ান্ত ফিক্স-ক্রম প্ল্যান (Critical + High একসাথে) — ✅ সবগুলো ফিক্স সম্পন্ন (২ আগস্ট ২০২৬)

| ক্রম | Issue | Severity | কেন এই ক্রমে |
|---|---|---|---|
| ১ | #2 — `/forgot-password` পেজ নেই | High | সবচেয়ে সহজ ফিক্স (একটা নতুন পেজ + Firebase-এর বিল্ট-ইন `sendPasswordResetEmail`), কোনো dependency নেই অন্য ফিক্সের সাথে, আর real user-এর প্রতিদিনের প্রয়োজনীয় একটা core flow — অগ্রাধিকার-অনুযায়ী প্রথমে করাই উচিত। |
| ২ | #1 — "Enter Panel" (tenant impersonation) সম্পূর্ণ অকার্যকর | Critical | Critical হলেও, ফিক্স তুলনামূলক isolated (শুধু super-admin অংশ) — কিন্তু ডিজাইন-সিদ্ধান্ত লাগবে (পুরো ফিচার বানানো vs UI থেকে বাটন সরানো), তাই প্রথমে fix-approach নিয়ে সিদ্ধান্ত দরকার, তারপর implement। |
| ৩ | #3 — `printerp_session` কুকি client-forgeable | Medium (কিন্তু route-security নীতির প্রশ্ন) | Issue #1-এর ফিক্সের (impersonation session ডিজাইন করলে) সাথে স্বাভাবিকভাবেই ওভারল্যাপ করে — একই সেশনে session/cookie আর্কিটেকচার নিয়ে কাজ করলে দুটো একসাথে সমাধান করা কার্যকর। |
| ৪ | #4 — পেমেন্ট amount dueAmount-এর সাথে ক্যাপড না | Medium | আর্থিক ডেটা-ইন্টিগ্রিটি ইস্যু, orders/payments মডিউলের মধ্যেই সীমাবদ্ধ একটা ফোকাসড ফিক্স। |
| ৫ | #5 — CSV এক্সপোর্টে formula-injection sanitization নেই | Medium | একটা ছোট, single-function ফিক্স (`escapeCsvCell`), কিন্তু দুই জায়গায় প্রভাব ফেলে (রিপোর্ট + সাধারণ export বাটন) — তুলনামূলক দ্রুত সমাধানযোগ্য। |
| ৬ | #6 — `audit_logs` create rule-এ `userId` verify হয় না | Medium | সবচেয়ে কম urgent (raw SDK access দরকার, insider-only ঝুঁকি) — একটা এক-লাইন rules পরিবর্তন, কিন্তু deploy করতে হলে পুরো `firestore.rules` আবার রিভিউ+টেস্ট করা ভালো, তাই শেষে ব্যাচ করে করাই efficient। |

**ব্যাচ-করে করা যেতে পারে:** #3 + #6 (দুটোই ছোট, ফোকাসড, একে অপরের সাথে সম্পর্কহীন rules/session টুইক) একই ফিক্স-সেশনে একসাথে করা যায় যদি চাইলে। #4 আর #5 প্রতিটাই স্বতন্ত্র, একা একা করা ভালো (financial logic vs export utility — মিশ্রিত করলে টেস্টিং জটিল হবে)।

---

## ফিক্স সেশন সারসংক্ষেপ (২ আগস্ট ২০২৬)

সবগুলো ৬টা issue একই সেশনে ফিক্স করা হয়েছে, ঠিক উপরের ক্রম অনুযায়ী। প্রতিটা ফিক্সের পর `tsc --noEmit` (০ error) এবং `eslint` (০ নতুন error/warning) দিয়ে যাচাই করা হয়েছে, আর সবশেষে পুরো প্রজেক্ট জুড়ে namespace-aware i18n চেক আবার চালিয়ে নিশ্চিত করা হয়েছে (bn/en key parity অক্ষত, ১৬৩৭টা `t()` কলের একটাও missing key না)।

| # | Issue | কী করা হয়েছে |
|---|---|---|
| #2 | `/forgot-password` পেজ নেই | নতুন পেজ (`app/(auth)/forgot-password/page.tsx`) তৈরি — Firebase Auth-এর `sendPasswordResetEmail` ব্যবহার করে, `/api/portal/track`-এর মতো একই anti-enumeration কনভেনশন মেনে (ইমেইল থাকুক বা না থাকুক একই সফল বার্তা)। নতুন schema (`forgotPasswordSchema`) ও ৭টা নতুন i18n key যোগ হয়েছে। |
| #1 | "Enter Panel" impersonation অকার্যকর | সম্পূর্ণ ফিচার বাস্তবায়নের বদলে (আলাদা privileged impersonation-session আর্কিটেকচার লাগত, এই ফিক্স-সেশনের স্কোপের বাইরে) UI থেকে সরানো হয়েছে — `TenantActionsMenu.tsx` ও tenant-detail পেজ থেকে বাটন, handler, confirm-dialog, dead sessionStorage কল সব সরানো হয়েছে; orphaned i18n key-ও পরিষ্কার করা হয়েছে। |
| #3 | Session cookie client-forgeable | `(super-admin)/layout.tsx`-এ `(tenant)/layout.tsx`-এর মতোই real Firebase Auth claims-ভিত্তিক গার্ড (`useAuthListener` + `useAuthStore`) যোগ করা হয়েছে — এখন স্পুফড কুকি দিয়ে middleware পার হলেও পেজ শেল রেন্ডার হবে না। `middleware.ts`/`session.ts`-এর কমেন্টও সংশোধন করা হয়েছে যাতে সঠিকভাবে বলে এটা শুধু UX-লেভেল রিডাইরেক্ট, প্রকৃত নিরাপত্তা না। |
| #4 | Payment amount dueAmount-ক্যাপ নেই | তিন স্তরে ফিক্স: (ক) `payment-modal.tsx`-এ client-side ম্যাক্স-ভ্যালিডেশন, (খ) `lib/firebase/orders.ts`-এর `recordPayment` transaction-এ stock.ts-এর প্যাটার্নে গার্ড, (গ) `firestore.rules`-এর payments `create` rule-এ `get()` cross-document lookup দিয়ে `amount <= order.dueAmount` সরাসরি enforce করা হয়েছে। |
| #5 | CSV formula-injection | `lib/utils/csv-export.ts`-এ OWASP-স্ট্যান্ডার্ড মিটিগেশন (leading `=`/`+`/`-`/`@`/ট্যাব/CR থাকলে `'` prefix) — শুধু string-টাইপ সেলে প্রয়োগ হয়, numeric কলামের বৈধ নেগেটিভ ভ্যালু (যেমন লোকসান) অক্ষত থাকে। |
| #6 | `audit_logs` create rule-এ `userId` verify হয় না | `firestore.rules`-এ `request.resource.data.userId == request.auth.uid` যোগ করা হয়েছে — বৈধ write-এ কোনো প্রভাব নেই (উভয় write-path সবসময় real caller uid ব্যবহার করে), শুধু স্পুফিং বন্ধ হয়েছে। |

**যা টেস্ট করা হয়নি (দ্রষ্টব্য):** এই সেশনে Firebase emulator/লাইভ প্রজেক্টে ডিপ্লয় করে end-to-end টেস্ট করা সম্ভব হয়নি (শুধু স্ট্যাটিক যাচাই — টাইপচেক, লিন্ট, i18n cross-check, rules-ফাইলের brace/syntax-balance)। বিশেষভাবে `firestore.rules`-এর দুইটা পরিবর্তন (payments-এর `get()` lookup, audit_logs-এর `userId` চেক) ডিপ্লয়ের আগে অন্তত emulator-এ (`npm run emulators`) একবার হাতে-কলমে টেস্ট করে নেওয়ার পরামর্শ থাকবে — Firestore rules-এর syntax সঠিক থাকলেও রানটাইম আচরণ সবসময় emulator-এ যাচাই করাই নিরাপদ।

---

## অতিরিক্ত ফিক্স (অডিট-স্কোপের বাইরে, ২ আগস্ট ২০২৬ পরবর্তী সেশনে পাওয়া) — Next.js dependency vulnerability

**[Critical] `next@14.2.29` — ডিসেম্বর ২০২৫-এর React Server Components ভালনারেবিলিটি (CVE-2025-66478, CVSS 10.0 RCE)-এর প্যাচড ভার্সনের নিচে ছিল**

- আগের সেশনে dependency install করার সময় npm-এর deprecation warning-এ এটা ধরা পড়েছিল, কিন্তু তখন "অডিট-স্কোপের বাইরে" বলে সরিয়ে রাখা হয়েছিল। ফলো-আপে ভালো করে দেখে বোঝা গেল এটা আসলে গুরুতর — `next@14.2.29` নিচের ভালনারেবিলিটি-গুলোর প্যাচড ভার্সনের (14.2.35) নিচে:
  - **CVE-2025-66478** (CVSS 10.0, RCE) — React Server Components protocol-এ, App Router অ্যাপে আক্রমণকারী-নিয়ন্ত্রিত রিকোয়েস্ট প্রসেস করার সময় remote code execution সম্ভব।
  - **CVE-2025-55184** (High, DoS) ও **CVE-2025-55183** (Medium, source-code exposure) — ১১ ডিসেম্বর ২০২৫-এর ফলো-আপ অ্যাডভাইজরি।
  - এই প্রজেক্ট সম্পূর্ণভাবে **App Router**-ভিত্তিক (Pages Router না — যেটা এই ভালনারেবিলিটি-গুলো থেকে মুক্ত), তাই সরাসরি ঝুঁকিতে ছিল।
- **ফিক্স:** `next` → `^14.2.35` এবং সঙ্গী `eslint-config-next` → `^14.2.35`-এ আপগ্রেড করা হয়েছে (package.json + package-lock.json)। আপগ্রেডের পর `tsc --noEmit` (০ error) ও পুরো প্রজেক্ট `eslint` (আগের মতোই শুধু ২টা পুরনো, অসম্পর্কিত warning) — দুটোই ক্লিন।
- **যাচাই করা যায়নি:** এই স্যান্ডবক্স পরিবেশে `npm run build` (production build) সম্পূর্ণ করা যায়নি — কারণ `next/font` বিল্ড-টাইমে Google Fonts (fonts.googleapis.com)-এ নেটওয়ার্ক অ্যাক্সেস চায়, যা এই পরিবেশের allowed-domain তালিকায় নেই (এই সীমাবদ্ধতা upgrade-এর কারণে না, মূল v23 কোডেও এই একই পরিবেশে বিল্ড করলে একই কারণে আটকাত)। **Deploy করার আগে আপনার নিজের পরিবেশে (ইন্টারনেট-সহ) অন্তত একবার `npm run build` চালিয়ে নিশ্চিত হয়ে নেওয়া জরুরি** — যদিও typecheck/lint ক্লিন, Next.js প্যাচ ভার্সনে মাঝেমধ্যে ছোট breaking change থাকে যা শুধু runtime/build-এ ধরা পড়ে।
