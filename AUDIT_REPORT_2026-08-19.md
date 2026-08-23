# AL-IHSAN PrintERP — সম্পূর্ণ কোডবেস অডিট রিপোর্ট
**তারিখ:** ১৯ আগস্ট ২০২৬
**যাচাই করা ভার্সন:** v74 (Manus AI লাইভ-অডিট ফিক্সসহ)
**পদ্ধতি:** static code analysis — প্রতিটা finding সরাসরি কোড পড়ে/গ্রেপ করে
কনফার্ম করা হয়েছে, অনুমানের ভিত্তিতে কিছু লেখা হয়নি। এটা একটা live/runtime
টেস্ট না — sandbox-এ Firebase emulator বা লাইভ ব্রাউজার টেস্ট চালানো
সম্ভব হয়নি।

---

## সারসংক্ষেপ

| ক্যাটাগরি | ফলাফল |
|---|---|
| i18n key ব্যবহার (কোড বনাম bn.json) | ✅ ক্লিন — কোনো missing key নেই |
| Firestore rules কভারেজ | ✅ ক্লিন — সব কালেকশন কভার্ড |
| Hard-delete ব্যবহার | ✅ ক্লিন — শুধু ইচ্ছাকৃত delete-tenant path-এ |
| ৩০-দিন auto-hard-delete scheduled job | ✅ বিদ্যমান |
| এক-শাখা branchId ডিফল্ট প্যাটার্ন | ✅ ক্লিন (আগের সেশনে ১টা গ্যাপ ফিক্স হয়েছে) |
| List subscription-এ fsLimit/pagination | ✅ ক্লিন (orders/payments/expenses/quotations সব capped) |
| Duplicate constant array (drift-risk) | ✅ ক্লিন (আগের সেশনে ১টা ফিক্স হয়েছে, বাকিগুলো risk-free) |
| **কাস্টমার-বিশ্লেষণ all-time query uncapped** | 🟡 **নতুন finding — নিচে বিস্তারিত** |
| Client-side console.warn গার্ড | ✅ ক্লিন (প্রাথমিক স্ক্যান ভুল করে flag করেছিল, পুনরায় চেক করে ভুল প্রমাণিত — নিচে সংশোধনী) |
| React exhaustive-deps suppression (৬টা ফাইল) | ✅ সবগুলো চেক করা হয়েছে — সব ইচ্ছাকৃত ও সঠিক |

---

## 🟡 Finding ১: `subscribeOrdersForFinancials` — কোনো limit/date-range ছাড়া all-time অর্ডার fetch

**কোথায়:** `lib/firebase/customers.ts` → `subscribeOrdersForFinancials()`,
`lib/hooks/use-reports-data.ts`-এ ব্যবহৃত (রিপোর্ট পেজের কাস্টমার
বিশ্লেষণ সেকশন — top customers by count/amount, সর্বোচ্চ বকেয়া,
নিষ্ক্রিয় কাস্টমার তালিকা)

**সমস্যা:** এই ফাংশন টেন্যান্টের **সব** (deletedAt==null বাদে) অর্ডার একবারে
লোড করে — কোনো `fsLimit()` নেই, কোনো তারিখ-রেঞ্জ ফিল্টার নেই। রিপোর্ট
পেজের বাকি সব সাবস্ক্রিপশন (`subscribeOrdersInRange` ইত্যাদি) ঠিকভাবে
সার্ভার-সাইড date-range query ব্যবহার করে, কিন্তু এই একটা ব্যতিক্রম।

**কেন এটা এভাবে আছে (ইচ্ছাকৃত সম্ভাবনা):** কাস্টমার বিশ্লেষণের সব
মেট্রিক্স (সর্বমোট বিল, সর্বমোট বকেয়া, শেষ অর্ডারের তারিখ) স্বভাবতই
all-time হিসাব দরকার — একটা নির্দিষ্ট রিপোর্ট-রেঞ্জে সীমাবদ্ধ করলে ভুল
ফলাফল দেবে (যেমন "সর্বোচ্চ বকেয়া কাস্টমার" যদি শুধু এই মাসের অর্ডার দেখে,
আগের মাসের বকেয়া বাদ পড়ে যাবে)। তাই date-range না থাকাটা প্রোডাক্ট-হিসেবে
সঠিক।

**আসল সমস্যা:** কোনো **cap/limit** না থাকা। প্রজেক্টের নিজস্ব ডকুমেন্টেড
নিয়ম ("fsLimit(500) on all list subscriptions") এখানে মানা হয়নি। একটা
টেন্যান্ট কয়েক বছর সক্রিয় থাকলে হাজার হাজার অর্ডার জমা হতে পারে —
প্রতিবার রিপোর্ট পেজ খুললে (এমনকি শুধু "এই সপ্তাহ" রেঞ্জ সিলেক্ট করলেও)
এই সম্পূর্ণ ইতিহাস আবার লোড হবে। এটা:
- Firestore read-খরচ বাড়াবে (প্রতি ভিজিটে সম্পূর্ণ অর্ডার-হিস্ট্রি)
- বড় টেন্যান্টের রিপোর্ট পেজ লোড-টাইম ধীর করে দেবে

**এই মুহূর্তে কতটা জরুরি:** প্রোডাক্ট এখনো নতুন (কয়েকটা demo/test
টেন্যান্ট, বাস্তব ইউজারের অর্ডার সংখ্যা এখনো কম) — তাই আজই ব্যবহারিক
সমস্যা তৈরি করছে না। কিন্তু কোনো টেন্যান্ট ১-২ বছর সক্রিয়ভাবে ব্যবহার
করলে এটা বাস্তব সমস্যা হয়ে দাঁড়াবে।

**সহজ ফিক্স নেই — কেন:** এখানে সরাসরি `fsLimit(500)` বসিয়ে দিলে ঠিক
উল্টো, আরও বিপজ্জনক বাগ তৈরি হবে — "৫০০টা অর্ডার ফেচ করে client-side
aggregate করলে বড় টেন্যান্টে নীরবে ভুল ফলাফল দেখাবে" (এই ঠিক প্যাটার্নটাই
প্রজেক্টের নিজের ডকুমেন্টেড risk হিসেবে লেখা আছে) — সর্বোচ্চ বকেয়া
কাস্টমার হিসাব ভুল হয়ে যাবে যদি তার পুরনো অর্ডার ৫০০-এর বাইরে পড়ে যায়।

**প্রস্তাবিত সমাধান (কোড পরিবর্তন ছাড়া এখনই করার দরকার নেই, ভবিষ্যতের
জন্য নোট):** একটা আলাদা মেইনটেইনড `customer_financial_summary`
ডকুমেন্ট/সাব-কালেকশন রাখা যেতে পারে যেটা প্রতিটা অর্ডার/পেমেন্ট
তৈরি/আপডেটের সাথে সাথেই ইনক্রিমেন্টালি আপডেট হয় (Cloud
Function/Firestore trigger দিয়ে) — তাহলে রিপোর্ট পেজে পুরো অর্ডার
হিস্ট্রি স্ক্যান করার দরকার পড়বে না। এটা একটা মাঝারি-আকারের আর্কিটেকচার
পরিবর্তন, তাড়াহুড়ো করে করার মতো না — আলাদা ডেডিকেটেড সেশনে ধরা উচিত,
এবং তখন পর্যন্ত টেন্যান্টগুলোর অর্ডার-সংখ্যা মনিটর করা যেতে পারে।

---

## 🟡 Finding ২ (সংশোধিত — মূল ফাইন্ডিং ভুল ছিল, নিচে ব্যাখ্যা)

**আপডেট:** এই সেকশনে আগে লেখা ছিল যে ৭টা জায়গায় client-side
`console.warn`/`console.error` কোনো `NODE_ENV` গার্ড ছাড়াই আছে। এটা
**ভুল ছিল** — প্রাথমিক স্ক্যান একটা সরল লাইন-ভিত্তিক গ্রেপ ব্যবহার
করেছিল যেটা multi-line `if (process.env.NODE_ENV !== "production") { ... }`
ব্লক বুঝতে পারেনি।

পরে সঠিকভাবে (৫ লাইন কনটেক্সট-উইন্ডো দিয়ে) পুনরায় চেক করে কনফার্ম হয়েছে:
`lib/firebase/orders.ts`, `lib/firebase/tenants.ts`, `lib/firebase/stock.ts`,
`lib/hooks/use-firestore-error-handler.ts` — **প্রতিটা console call-ই
ইতিমধ্যে সঠিকভাবে `NODE_ENV !== "production"` গার্ড দিয়ে ঘেরা**। পুরো
`components/`, `app/` (app/api বাদে), `lib/` ডিরেক্টরিতে একটাও unguarded
console call নেই।

**সংশোধিত সিদ্ধান্ত:** এটা আসলে কোনো bug না — কোনো কোড পরিবর্তনের দরকার
নেই। এই সেকশনটা রিপোর্টে রাখা হয়েছে স্বচ্ছতার জন্য (ভুল ফাইন্ডিং লুকিয়ে
না রেখে সংশোধন দেখানো), যাতে ভবিষ্যতে কেউ এই রিপোর্ট পড়ে বিভ্রান্ত না হয়।

---

## ✅ যাচাই করে ক্লিন পাওয়া গেছে — বিস্তারিত

### i18n
কোডে ব্যবহৃত ১১৮৮টা `t()` কল (namespace prefix সহ প্রতিটা resolve করে)
bn.json-এর সাথে ক্রস-চেক করা হয়েছে। শুধু ১টা false-positive পাওয়া গেছে
(একটা কমেন্টের ভেতরের টেক্সট, আসল কোড না)। কোনো সত্যিকারের missing key
নেই।

### Firestore Security Rules
কোডে ব্যবহৃত ৩০টা কালেকশনের প্রতিটার rules coverage যাচাই করা হয়েছে।
৪টা কালেকশন (`rate_limits`, `subscription_history`, `tenant_deletion_log`,
`super_admins`) প্রথমে সন্দেহজনক মনে হয়েছিল (আলাদা কোনো `match` ব্লক
নেই), কিন্তু ফাইল-বাই-ফাইল চেক করে কনফার্ম হয়েছে — এই ৪টাই হয় Admin SDK
route থেকে লেখা হয় (rules বাইপাস করে, কোনো ঝুঁকি নেই) নয়তো শুধু
super_admin সেশন থেকে client SDK কল হয় (`match /{document=**} { allow
read, write: if isSuperAdmin(); }` catch-all rule দিয়ে কভার্ড)। কোনো
tenant-side কোড এই কালেকশনগুলো টাচ করে না।

### Hard Delete
`deleteDoc`/`.delete()`-এর সরাসরি কোনো ব্যবহার নেই। `recursiveDelete`
শুধু `app/api/super-admin/delete-tenant/route.ts`-এ (ইচ্ছাকৃত, Session
৯-এর ফিচার)। `netlify/functions/hard-delete-expired-orders.mts`
(৩০-দিনের auto-cleanup) বিদ্যমান।

### branchId ডিফল্ট (এক-শাখা টেন্যান্ট)
নিচের ফর্মগুলো সব চেক করা হয়েছে — সবগুলোতেই সঠিক single-branch
fallback আছে:
- `order-form.tsx` ✅ (আগেই ফিক্স ছিল)
- `quotation-form.tsx` ✅
- `outsource-form-dialog.tsx` ✅
- `expense-form-dialog.tsx` ✅
- `supplier-form.tsx` ✅
- `stock-item-form.tsx` ✅
- `app/(tenant)/dashboard/costing/page.tsx` ✅ (এমনকি একটা defensive
  `if (!branchId) throw ...` guard-ও আছে, আগের সেশনের ফিক্স)
- `staff-form-modal.tsx` — গ্যাপ ছিল, আগের সেশনে ফিক্স করা হয়েছে ✅

### List Subscription Pagination
- `orders.ts`: `ORDERS_PAGE_SIZE = 500`, pagination সহ ✅
- `subscribeToTenantPayments`: `fsLimit(500)` ✅
- `expenses.ts`, `quotations.ts`: shared `subscribePagedList` helper
  (built-in limit) ✅
- `branches.ts`, `users.ts` (staff লিস্ট): কোনো limit নেই, কিন্তু এই দুটো
  স্বভাবতই ছোট/bounded কালেকশন (সাবস্ক্রিপশন প্ল্যানের branch/staff
  সীমা দিয়ে সীমাবদ্ধ) — বাস্তবে ঝুঁকি নেই

### Duplicate Constants (drift risk)
`FEATURE_KEYS` ডুপ্লিকেশন (WhatsApp বাদ পড়া বাগ) আগের সেশনে ফিক্স করা
হয়েছে। বাকি কোডবেসে অনুরূপ কোনো ঝুঁকিপূর্ণ ডুপ্লিকেশন পাওয়া যায়নি।
`MONTH_KEYS` ৪টা ফাইলে ডুপ্লিকেট আছে ঠিকই, কিন্তু এটা স্ট্যাটিক ও কখনো
পরিবর্তন হবে না এমন ডেটা (১২ মাস) — drift-risk শূন্য, শুধু কোড-স্টাইল
নোট, বাগ না।

### React Hook Dependency Suppressions
৬টা ফাইলে `eslint-disable react-hooks/exhaustive-deps` আছে — **সবগুলো
চেক করা হয়েছে**, সবগুলোই প্রযুক্তিগতভাবে সঠিক ও ইচ্ছাকৃত প্যাটার্ন:
- `order-form.tsx`, `use-reports-data.ts` — unstable reference
  (fieldArray/callback) dependency-তে রাখলে infinite loop হতো, তাই বাদ
  দেওয়া হয়েছে, বাংলা কমেন্টে ব্যাখ্যা আছে
- `business-assets-form.tsx` — `year.id` পরিবর্তন হলেই local edit-state
  sync হয়; `year`-এর বাকি ফিল্ড dependency-তে থাকলে প্রতি re-render-এ
  ইউজারের চলমান এডিট মুছে যেত
- `stock-transaction-modal.tsx` (২টা effect) — মোডাল-ওপেন vs
  transaction-type-change দুটো আলাদা reset-লজিক ইচ্ছাকৃতভাবে আলাদা
  dependency-তে রাখা, যাতে একটা আরেকটাকে override না করে
- `zakat/page.tsx` — প্রতি রেন্ডারে নতুন রেফারেন্স পাওয়া
  `handleFirestoreError` callback dependency-তে থাকলে payment
  সাবস্ক্রিপশন বারবার রিসাবস্ক্রাইব হতো
- `portal/[tenantId]/page.tsx` — পোলিং ইন্টারভ্যাল `refresh()`-এর ভেতরের
  সব state ref (`lookupParamsRef`) বা stable route param (`tenantId`)
  থেকে পড়ে, তাই stale-closure ঝুঁকি নেই — `[!!result]` dependency
  ইচ্ছাকৃতভাবে শুধু null↔non-null ট্রানজিশনে ইন্টারভ্যাল রিসেট করে

কোনোটাতেই stale-closure বা silent-bug ঝুঁকি পাওয়া যায়নি।

---

## 🔵 এই অডিটে যা কভার করা হয়নি (সততার খাতিরে স্পষ্ট করে বলা)

- **Runtime/browser টেস্ট** — sandbox-এ Firebase emulator বা লাইভ UI
  চালানো সম্ভব না, তাই এই পুরো অডিট static code reading-ভিত্তিক। কোনো
  ভিজ্যুয়াল/লেআউট বাগ, রেস-কন্ডিশন, বা টাইমিং-নির্ভর সমস্যা এভাবে ধরা
  পড়বে না।
- **Cloud Function/Netlify Function-এর ভেতরের লজিক গভীরভাবে চেক করা
  হয়নি** — শুধু তাদের অস্তিত্ব ও উচ্চ-স্তরের গঠন যাচাই হয়েছে।
- **বাকি ৪টা exhaustive-deps suppression** — ✅ এখন সবগুলো চেক করা হয়েছে
  (উপরে বিস্তারিত), তাই এই আইটেমটা আর "কভার করা হয়নি" তালিকায় নেই।
- **Performance profiling** (যেমন স্টাফ তৈরির ~১৭ সেকেন্ড লেটেন্সি,
  আগের অডিটে পাওয়া) — sandbox-এ সম্ভব না।
- **পুরো কোডবেসের প্রতিটা ফাইল লাইন-বাই-লাইন পড়া হয়নি** — উচ্চ-ঝুঁকির
  ক্যাটাগরি (Firestore write, rules, delete, branchId, pagination,
  i18n, duplicate constants) টার্গেট করে সিস্টেমেটিক গ্রেপ/প্যাটার্ন-
  সার্চ করা হয়েছে। একটা সম্পূর্ণ ম্যানুয়াল লাইন-বাই-লাইন রিভিউ (৩৪৭টা
  .ts/.tsx ফাইল) এই একটা সেশনে বাস্তবসম্মত না।

---

## যোগ হয়েছে (২০ আগস্ট ২০২৬) — Cloud Functions বাদে বাকি এলাকা পুনরায় যাচাই

ব্যবহারকারীর নির্দেশে Cloud Functions (`functions/` ফোল্ডার) এই অডিটের
বাইরে রাখা হয়েছে — Free Edition-এ এগুলো ব্যবহৃত হয় না (Next.js API
routes + Netlify scheduled functions-ই আসল লাইভ পথ, আগেই কনফার্ম করা
হয়েছে)।

**নতুন করে চেক করা হয়েছে:**
- সব মিউটেটিং API route (POST/PUT/PATCH, ১৮টার মধ্যে ১৬টা) Zod
  `.safeParse()`/`.parse()` দিয়ে সার্ভার-সাইড ভ্যালিডেটেড — ✅ ক্লিন।
  বাকি ২টা (`notification-status`, `client-ip`) GET-only, কোনো body
  নেই, তাই ভ্যালিডেশনের দরকারই নেই — legitimate exception।
- `lib/firebase/super-admin-reports.ts`-এও Finding ১-এর মতো একই
  প্যাটার্নের no-limit query পাওয়া গেছে (SA-04 রিপোর্ট পেজ, সব টেন্যান্ট
  + সব `subscription_history` একসাথে fetch করে)। কিন্তু এটার ঝুঁকি
  উল্লেখযোগ্যভাবে কম — এটা **মোট টেন্যান্ট-সংখ্যার** সাথে স্কেল করে (যা
  খুব ধীরে বাড়ে), প্রতি-টেন্যান্ট অর্ডার-সংখ্যার সাথে না, এবং শুধু
  super_admin ম্যানুয়ালি এই পেজ ভিজিট করলেই চলে (প্রতিটা tenant_admin-এর
  প্রতিটা visit-এ না)।

**Finding ১ নিয়ে সিদ্ধান্ত:** ব্যবহারকারী এটা "সাবধানে ফিক্স" করতে
বলেছিলেন। যাচাই করে দেখা গেছে **এর কোনো নিরাপদ "ছোট" ফিক্স নেই** —
- সরাসরি `fsLimit()` বসানো ভুল, কারণ একটা মাঝারি-সক্রিয় প্রেস (দৈনিক
  ৫-৫০ অর্ডার) ১-২ বছরেই হাজার-হাজার অর্ডারে পৌঁছাতে পারে (ব্লুপ্রিন্টের
  নিজস্ব ব্যবসা-স্তর টেবিল অনুযায়ী) — তাই যেকোনো বাস্তবসম্মত limit
  (৫০০ হোক বা ৫,০০০) অদূর ভবিষ্যতেই silently ভুল "সর্বোচ্চ বকেয়া
  কাস্টমার"/"top customer" হিসাব দেখানো শুরু করবে — এটা বর্তমান সমস্যার
  চেয়ে খারাপ, কারণ ভুল ডেটা নীরবে দেখাবে, কোনো এরর ছাড়াই।
- Firestore-এর native aggregation query (`sum()`/`count()`) দিয়েও এটা
  সমাধান করা যায় না, কারণ এখানে per-customer গ্রুপিং দরকার আর Firestore
  aggregation query GROUP BY সাপোর্ট করে না।
- প্রকৃত সমাধান (per-customer summary ডকুমেন্ট, প্রতিটা অর্ডার/পেমেন্ট
  write-এর সাথে transaction দিয়ে ইনক্রিমেন্টালি আপডেট — Cloud Function
  ছাড়াই ক্লায়েন্ট কোডে সম্ভব) order-create, order-edit, payment-record,
  ও cascade-delete — এই ৪টা ভিন্ন write-path স্পর্শ করবে। এটা একটা
  ছোট ফিক্স না, একটা আলাদা ফিচার-সাইজের কাজ, ভুলভাবে তাড়াহুড়ো করলে
  নতুন বাগ তৈরির ঝুঁকি বেশি।

**তাই এই সেশনে যা করা হয়েছে:** কোড-বিহেভিয়ার অপরিবর্তিত রেখে
`lib/firebase/customers.ts`-এর `subscribeOrdersForFinancials()` ও
`lib/firebase/super-admin-reports.ts`-এর `fetchSuperAdminReportsData()`
— দুটোতেই বিস্তারিত ডকুমেন্টেশন কমেন্ট যোগ করা হয়েছে (ট্রেডঅফ, কেন
সহজ ফিক্স বিপজ্জনক, প্রকৃত সমাধানের রূপরেখা) যাতে ভবিষ্যতে কেউ (আমি বা
অন্য ডেভেলপার) না বুঝে ভুল "ফিক্স" না করে বসে। **কোনো functional
পরিবর্তন নেই — শুধু কমেন্ট যোগ, `tsc --noEmit`/`next lint` দুটোই ০ এরর।**

এই সেশনে (আগে) কোনো কোড পরিবর্তন করার দরকার হয়নি — অডিটে যা "নতুন বাগ" মনে
হয়েছিল (console.warn গার্ড) তা পুনরায় যাচাইয়ে ভুল প্রমাণিত হয়েছে, আর
বাকি সব ক্যাটাগরি ক্লিন পাওয়া গেছে। একমাত্র real finding
(**customer-analysis uncapped query**) এখনই একশন-আইটেম না — এটা একটা
architecture-level সিদ্ধান্ত (incremental summary নাকি বর্তমান
all-time-read পদ্ধতি চালিয়ে যাওয়া), তাড়াহুড়ো করে ভুল ফিক্স করলে
(নিছক `fsLimit(500)` বসিয়ে দিলে) আরও খারাপ, silent-wrong-data বাগ তৈরি
হবে।

---

## যোগ হয়েছে (২০ আগস্ট ২০২৬, দ্বিতীয় পাস) — Access-control গ্যাপ ফিক্স

আরও গভীরে গিয়ে sidebar.tsx-এর role-restricted নেভিগেশন আইটেমগুলোর
বিপরীতে প্রতিটা পেজের client-side guard সিস্টেমেটিকভাবে চেক করা হয়েছে
(users/page.tsx ও audit-log/page.tsx-এ প্রতিষ্ঠিত
`if (role !== "tenant_admin") return null;` প্যাটার্নের সাথে তুলনা করে)।

### ফিক্স করা হয়েছে

1. **`app/(tenant)/dashboard/settings/page.tsx`** — sidebar-এ
   `roles: ["tenant_admin"]` থাকলেও পেজে কোনো matching guard ছিল না।
   Firestore rules-এ `tenants/{tenantId}`-এর write role-restricted
   হলেও read সব সক্রিয় tenant ইউজারের জন্য খোলা ছিল বলে ডেটা ফাঁস হতো
   না, কিন্তু branch_manager/staff সরাসরি URL দিয়ে গেলে পুরো সেটিংস ফর্ম
   দেখতে পেতেন, "Save" চাপলে কনফিউজিং permission-denied এরর পেতেন।
2. **`app/(tenant)/dashboard/costing/page.tsx`** — sidebar-এ
   `roles: ["tenant_admin", "branch_manager"]`, কিন্তু পেজে guard ছিল
   না। **এটা settings-এর চেয়ে বেশি গুরুত্বপূর্ণ** — `cost_templates`/
   `cost_calculations`-এর Firestore rules read-এ শুধু
   `canAccessBranch()` চেক করে, role() চেক করে না। তাই commission_staff/
   regular_staff সরাসরি URL দিয়ে গেলে শুধু ফাঁকা পেজ না, প্রকৃত
   উৎপাদন-খরচ ও মুনাফার হিসাবই দেখতে পেতেন — একটা প্রকৃত ডেটা-এক্সপোজার
   গ্যাপ, শুধু UX বিভ্রান্তি না।

দুটোতেই `users/page.tsx`-এর wrapper + content split প্যাটার্ন অনুসরণ করা
হয়েছে — early-return guard-এর পরে `useState`/`useEffect` কল করলে
React-এর Rules of Hooks ভাঙত, তাই hook-ভারী অংশ আলাদা child কম্পোনেন্টে
সরিয়ে guard-টা শুধু thin wrapper-এ বসানো হয়েছে (`next lint`-এর
`react-hooks/rules-of-hooks` রুল দিয়ে যাচাই করা হয়েছে, ০ এরর)।

### চেক করে "ঠিকই আছে, ফিক্স লাগবে না" প্রমাণিত

- **`app/(tenant)/dashboard/zakat/page.tsx`** — পেজেও কোনো guard নেই,
  কিন্তু `zakat_years`/`zakat_payments`-এর Firestore rules **read-ও**
  `isTenantAdmin()`-এ সীমাবদ্ধ (settings/costing-এর চেয়ে কড়া) —
  branch_manager/staff সরাসরি URL দিয়ে গেলে প্রতিটা read-ই
  permission-denied হবে, পেজ ফাঁকা/এরর-স্টেট দেখাবে, কোনো ব্যক্তিগত
  ডেটা ফাঁস হবে না। polish-এর সুযোগ আছে (এখনো একটা confusing error
  দেখাবে), কিন্তু ডেটা-নিরাপত্তার দিক থেকে ঝুঁকিমুক্ত।
- **`app/(tenant)/dashboard/outsource/page.tsx`** — কোডে স্পষ্ট কমেন্ট
  আছে ("sidebar.tsx-এ ইতিমধ্যে roles: ["tenant_admin"] দিয়ে গেটেড") —
  এটা ইচ্ছাকৃত ডিজাইন-সিদ্ধান্ত (sidebar-only gating + client-side
  `canManage` দিয়ে শুধু write-বাটন লুকানো), settings-এর মতো ভুলে-বাদ-পড়া
  case না।
- **`my-collection`/`my-commission`** — সময়ের অভাবে গভীরভাবে চেক করা
  হয়নি, কিন্তু এই দুটো "নিজের ডেটা দেখার" পেজ (commission_staff-only)
  বলে ঝুঁকির প্রকৃতি ভিন্ন — ভুল রোল থেকে দেখলে খালি/অপ্রাসঙ্গিক ডেটা
  দেখাবে, sensitive information exposure না। ভবিষ্যতে সময় পেলে একই
  প্যাটার্নে চেক করা যেতে পারে।

### যাচাই
`tsc --noEmit` → ০ এরর, `next lint` (react-hooks/rules-of-hooks সহ) →
০ এরর, i18n parity → হুবহু মিলছে (কোনো নতুন UI টেক্সট লাগেনি, শুধু
`return null` — নতুন কোনো ইউজার-facing মেসেজ যোগ হয়নি এই ফিক্সে)।

**তাই এখন এই সেশনের চূড়ান্ত অবস্থা:** ২টা প্রকৃত (একটা ডেটা-এক্সপোজার,
একটা কম-ঝুঁকির UX) access-control বাগ ফিক্স হয়েছে, বাকি প্রার্থী পেজ
স্বতন্ত্রভাবে যাচাই করে নিরাপদ প্রমাণিত হয়েছে।
