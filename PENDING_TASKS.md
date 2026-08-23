# বাকি/পরবর্তী কাজের তালিকা (Pending Tasks)

> এই ফাইলটা AL-IHSAN PrintERP প্রজেক্টের সব ধরনের বাকি-থাকা, স্থগিত-রাখা,
> বা ভবিষ্যতের জন্য পরিকল্পিত কাজের একক, কেন্দ্রীয় তালিকা। নতুন কোনো Claude
> সেশন শুরু করলে, বা অন্য কোনো ডেভেলপারকে প্রজেক্ট বুঝিয়ে দিলে — শুধু এই
> ফাইলটা পড়লেই "এখন কী বাকি" পুরোপুরি স্পষ্ট হয়ে যাবে।
>
> **সর্বশেষ আপডেট:** ১৮ আগস্ট ২০২৬ (Manus AI লাইভ-অডিট রিপোর্ট থেকে ৪টা নতুন বাগ ফিক্স)
> **নিয়ম:** কোনো কাজ শুরু/শেষ হলে এই ফাইলটাও সাথে সাথে আপডেট করতে হবে —
> নাহলে এই ফাইলটাই অপ্রাসঙ্গিক হয়ে পড়বে।

---

## 🟢 সম্পন্ন — Manus AI লাইভ-অডিট রিপোর্ট রিভিউ ও ৪টা বাগ ফিক্স (১৮ আগস্ট ২০২৬)

ব্যবহারকারী দুটো external অডিট রিপোর্ট (Manus AI, লাইভ সাইট
al-ihsan-print.netlify.app-এ বাস্তব টেস্টিং + কোড-রিভিউ) শেয়ার করেছিলেন —
একটা টেন্যান্ট-সাইড, একটা সুপার-অ্যাডমিন-সাইড। প্রতিটা claim কোড পড়ে
স্বাধীনভাবে যাচাই করা হয়েছে, ডকুমেন্টেশন অন্ধভাবে বিশ্বাস করা হয়নি।

### নতুন বাগ না — শুধু ডিপ্লয়মেন্ট বাকি বলেই লাইভে দেখা যাচ্ছে
- **"এক-শাখা টেন্যান্ট অর্ডার তৈরি করতে পারে না" (রিপোর্টে সবচেয়ে গুরুতর
  বলা হয়েছে)** — `order-form.tsx`-এ কোড দেখে কনফার্ম করা হলো: এই ফিক্স
  (branches.length===1 হলে branchId অটো-সেট, ১২ আগস্ট) ও zero-branch
  সাইনআপ ফিক্স (১৫ আগস্ট, signup route-এ ডিফল্ট "প্রধান শাখা" অটো-তৈরি)
  দুটোই কোডে **আগে থেকেই আছে**। লাইভ সাইট এখনো পুরনো (প্রি-v42-বা-তার
  কাছাকাছি) কোড চালাচ্ছে বলেই এই বাগ ধরা পড়েছে — উপরের "🔴 জরুরি —
  ব্লকিং" সেকশনের "২. ডিপ্লয়মেন্ট" আইটেমই এর সমাধান, নতুন কোনো কোড লাগে না।
- **অ্যাক্টিভিটি লগ পেজ (`/dashboard/audit-log`) লোড হয় না ("Could not
  load logs")** — `fetchAuditLogPage()` (lib/firebase/audit.ts) সরাসরি
  Firestore composite query চালায় (`resourceType` + `createdAt`,
  কখনো কখনো `+ date range`ও)। এই কম্পোজিট ইনডেক্স
  `firestore.indexes.json`-এ **আগে থেকেই আছে** (`audit_logs` কালেকশনে
  ২টা এন্ট্রি — collection-scope ও collection-group-scope)। rules/index
  ডিপ্লয় বাকি থাকায় লাইভে এই ইনডেক্স নেই বলেই "missing index" এরর আসার
  কথা। কোনো নতুন কোড/ইনডেক্স যোগ করা হয়নি — এটাও ডিপ্লয়মেন্টেই সমাধান হবে।

### সত্যিকারের নতুন বাগ — কোডে খুঁজে কনফার্ম করে ফিক্স করা হলো
1. **সুপার-এডমিন প্ল্যাটফর্ম অডিট লগে raw i18n key** (`auditLog.action.
   tenant_suspended` / `tenant_reactivated` verbatim দেখাচ্ছিল, Bengali
   অনুবাদ ছাড়া) — root cause: `app/api/super-admin/sync-tenant-claims/
   route.ts` `action: "tenant.suspended"` / `"tenant.reactivated"` সরাসরি
   Admin SDK দিয়ে Firestore-এ লেখে, কিন্তু এই দুটো স্ট্রিং
   `lib/types/audit.ts`-এর `AuditAction` union type-এ কখনো যোগ হয়নি —
   Admin SDK route-এর raw object literal write এই টাইপের বিপরীতে চেক হয়
   না বলে TypeScript এটা ধরতে পারেনি। **ফিক্স:** `AuditAction` union-এ
   দুটো action যোগ, `AUDIT_ACTION_CATEGORY` ম্যাপে `"tenant"` ক্যাটাগরি
   assign, `messages/bn.json` ও `messages/en.json`-এ
   `auditLog.action.tenant_suspended`/`tenant_reactivated` translation যোগ।
2. **Tenant Details পেজে "Activated By" raw Firebase Auth UID দেখাচ্ছিল**
   (যেমন `zIRt5ITwPHXFWZPKQLWvZVLsvll1`) — `activateTenant()`
   (lib/firebase/tenants.ts) ও `create-tenant` API route শুধু UID সেভ
   করত, ইমেইল না। **ফিক্স:** দুটো জায়গাতেই নতুন `activatedByEmail` ফিল্ড
   সেভ হয় এখন (Tenant type-এও যোগ হয়েছে); `ActivateTenantModal.tsx`-এ
   নতুন `adminEmail` prop (কল-সাইটে `user?.email` পাস করা হয়) এবং
   `create-tenant/route.ts`-এ verified ID token-এর `decoded.email` থেকে।
   Tenant Detail পেজ এখন `activatedByEmail || activatedBy` দেখায় —
   এই ফিক্সের **আগে** activate/create হওয়া পুরনো টেন্যান্টে এই ফিল্ড
   না থাকায় raw UID-তেই fallback করবে (পরের বার re-activate করলে ঠিক
   হয়ে যাবে, backward-compatible fallback ইচ্ছাকৃত)।
3. **Tenant Details-এর Active Features তালিকায় "WhatsApp Notifications"
   ছিল না** (Edit মোডালে টগল আছে, কিন্তু ডিটেল-ভিউতে দেখাত না) — root
   cause: `app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`-এ
   একটা স্থানীয় ডুপ্লিকেট `FEATURE_KEYS` অ্যারে ছিল যেখানে
   `whatsappNotifications` ভুলে বাদ পড়ে গিয়েছিল, অথচ
   `lib/types/tenant.ts`-এ ইতিমধ্যে একটা single-source-of-truth
   `ALL_FEATURE_KEYS` (১৬টা key, সব জায়গায় ব্যবহারের জন্য) ছিল। **ফিক্স:**
   স্থানীয় ডুপ্লিকেট মুছে `ALL_FEATURE_KEYS` সরাসরি import/ব্যবহার করা
   হচ্ছে — ভবিষ্যতে নতুন ফিচার যোগ হলে দুই জায়গায় আলাদা মনে রেখে আপডেট
   করার দরকার নেই।
4. **স্টাফ তৈরি ফর্মে এক-শাখা টেন্যান্টেও শাখা ড্রপডাউন ডিফল্ট "—
   শাখা নেই —"** (`— No branch —`) — `order-form.tsx`-এ আগে ফিক্স হওয়া
   একই প্যাটার্নের বাগ, কিন্তু সম্পূর্ণ ভিন্ন ফাইলে (`staff-form-modal.tsx`)
   — তাই সেই ফিক্স এখানে কভার করেনি। **ফিক্স:** নতুন `useEffect` যোগ,
   create mode-এ (edit mode ছোঁয়া হয়নি) `branches.length === 1` হলে
   `branches[0].id` অটো-সিলেক্ট করে — `order-form.tsx`-এর সমাধানের সাথে
   হুবহু সামঞ্জস্যপূর্ণ প্যাটার্ন।

### অনিশ্চিত — আন্দাজে ফিক্স করা হয়নি, আরও তথ্য/রিপ্রোডাকশন-স্টেপ দরকার
- **"Subscription History: No history yet" বনাম Activated By/At পূরণ
  থাকা** — `activateTenant()` একই batch-এ `subscription_history` এন্ট্রিও
  লেখে (কোডে কনফার্ম করা হয়েছে), তাই যদি `activatedBy`/`activatedAt`
  পূরণ থাকে, একটা matching history এন্ট্রিও থাকার কথা। কিন্তু অডিটর
  একই টেন্যান্টে পরপর কয়েকটা টেস্ট (suspend→reactivate ইত্যাদি) চালিয়েছেন
  বিভিন্ন সময়ে — তাই এটা রেস-কন্ডিশন/টাইমিং-এর বিভ্রান্তি নাকি প্রকৃত
  bug, নিশ্চিত হওয়া যায়নি রিপোর্টের বিবরণ থেকে।
- **Trial Highlights widget-এ "3 days left Trial" বনাম Tenant Management
  টেবিলে "Standard/Active"** — একই ধরনের টাইমিং/রিপ্রোডাকশন-অস্পষ্টতা,
  সম্ভবত দুটো ভিন্ন টেন্যান্ট (Manus Test Press বনাম অডিটর টেস্ট প্রেস)
  গুলিয়ে ফেলা হয়েছে রিপোর্টে।
- **"25"/"25" নামের টেন্যান্ট** — ডেটা-কোয়ালিটি ইস্যু (ফাঁকা নামে
  সাইনআপ), কোড বাগ না। ভবিষ্যতে signup ফর্মে ফাঁকা-নাম ভ্যালিডেশন যোগ
  করা যেতে পারে (এই সেশনে করা হয়নি, ছোট/ঐচ্ছিক)।
- **স্টাফ তৈরিতে ~১৭ সেকেন্ড লোডিং** — Admin SDK API route-এর latency,
  পারফরম্যান্স অপ্টিমাইজেশনের বিষয়, sandbox-এ প্রোফাইল করে root cause
  বের করা সম্ভব না। প্রয়োজনে আলাদা সেশনে ধরা যেতে পারে।

### যাচাই
`tsc --noEmit` → ০ এরর, `next lint` → ০ এরর, i18n parity (bn/en) → হুবহু
মিলছে (নতুন ২টা translation key দুই ফাইলেই সমানভাবে যোগ হয়েছে)।

---

## 🟡 চলমান — ইউজার-রিপোর্টেড ১২টা ফিডব্যাক (৯-সেশনের পরিকল্পনা, ১৭ আগস্ট ২০২৬)

সম্পূর্ণ ৯-সেশনের প্রম্পট চ্যাট হিস্ট্রিতে আছে (কপি করে পরের সেশনে ব্যবহার
করুন)। দুটো প্রোডাক্ট-সিদ্ধান্ত নিশ্চিত হয়েছে: (ক) অর্ডার "ডিলিট" করলে
সংশ্লিষ্ট পেমেন্টও সব জায়গা থেকে সরে যাবে (soft-delete cascade দিয়ে,
হার্ড-ডিলিট নয়) — কিন্তু "ক্যানসেল" (বিদ্যমান আলাদা status, ইতিমধ্যেই আছে)
করলে পেমেন্ট হিস্ট্রি অক্ষত থাকবে; (খ) পার্মানেন্ট টেন্যান্ট ডিলিট সত্যিকারের
সম্পূর্ণ হার্ড-ডিলিট হবে (Suspended আলাদাভাবে ডেটা-সহ-লক কভার করে)।

- ✅ সেশন ১: গ্রস/নেট মুনাফা আইকন ফিক্স, সুপার এডমিন রিপোর্ট গ্রাফে
  raw translation key বাগ ফিক্স, ৫টা সুপার-এডমিন ফর্ম-ডায়ালগে
  আউটসাইড-ক্লিক-লক (`preventOutsideClose`) যোগ। বিস্তারিত
  `MODULE_README.md`।
- ✅ সেশন ২: অর্ডার-ডিলিট → পেমেন্ট ক্যাসকেড (Payment টাইপে deletedAt
  যোগ, backfill script, softDeleteOrder() cascade, সব report/dashboard/
  payment-list query-তে ফিল্টার)। বিস্তারিত `MODULE_README.md`।
- 🟡 সেশন ৩ (আংশিক): "টেন্যান্ট এডিট সেভ হয় না" — root cause পাওয়া গেছে
  ও ফিক্স হয়েছে (`updateTenant()`-এ featureOverrides-এর undefined-value
  key Firestore `updateDoc()`-কে throw করাচ্ছিল, `ignoreUndefinedProperties`
  সেট করা নেই বলে)। বিস্তারিত `MODULE_README.md`। **এখনো ওপেন:**
  "সাবস্ক্রিপশন প্যাকেজ মডিউল (SA-03) কার্যকরী নয়" — কোডে অনুরূপ bug
  পাওয়া যায়নি, লাইভ কনসোল এরর/সঠিক উপসর্গ ছাড়া আন্দাজে ফিক্স করা হয়নি।
- ✅ সেশন ৪: প্যাকেজ মূল্য বসানো (বেসিক ৩০০/৩০০০, স্ট্যান্ডার্ড ৫০০/৫০০০,
  প্রিমিয়াম ৭০০/৭০০০) — `DEFAULT_PLAN_CATALOG` কোডে আপডেট +
  `scripts/seed-plan-prices.js` (লাইভ Firestore-এ বসাতে চালাতে হবে)।
  বিস্তারিত `MODULE_README.md`।
- ✅ সেশন ৫: সাইডবার/টপবার sticky — কোড-রিভিউতে কনফার্ম হলো ইতিমধ্যেই
  সঠিকভাবে কাজ করছে (কোনো পরিবর্তন লাগেনি, edge case সহ)। প্রোফাইল
  ছবি আপলোডও ইতিমধ্যে সম্পূর্ণ implement করা ছিল (Cloudinary,
  লোগো-আপলোড প্যাটার্ন থেকে হুবহু পুনর্ব্যবহার করা) — কিন্তু
  `firestore.rules`-এ একটা আসল বাগ পাওয়া গেছে ও ফিক্স হয়েছে:
  non-tenant_admin রোলের self-service `avatarUrl` write allowlist-এ
  ছিল না, যা তাদের প্রোফাইল ছবি আপলোড ভাঙত (`permission-denied`)।
  বিস্তারিত `MODULE_README.md`। **ডিপ্লয়ের আগে দেখুন নিচের "০.৮"।**
- ✅ সেশন ৬ (১৮ আগস্ট ২০২৬): রিপোর্ট পেজ (`/dashboard/reports`) KPI ও
  বিশ্লেষণ সেকশন ড্রিলডাউন। `admin-dashboard.tsx`-এ আগে থেকেই থাকা
  href-navigation প্যাটার্ন `financial-kpi-cards.tsx`-এ এক্সটেন্ড করা
  হয়েছে (`shared/kpi-card.tsx`-এর বিদ্যমান মেকানিজম, নতুন কোড লাগেনি):
  - মোট অর্ডার/মোট আয় → `/dashboard/orders`
  - মোট কালেকশন → `/dashboard/payments`
  - মোট কস্টিং → `/dashboard/costing`
  - মোট খরচ → `/dashboard/expenses`
  - মোট বকেয়া → `/dashboard/orders?filter=due`
  - গ্রস মুনাফা ও নেট মুনাফা ইচ্ছাকৃতভাবে non-clickable (derived সংখ্যা,
    এর পেছনে কোনো একক তালিকা পেজ নেই)
  পাশাপাশি বাকি সেকশনও ক্লিকযোগ্য করা হয়েছে:
  - আইটেম বিশ্লেষণ টেবিলের সারি → `/dashboard/orders?q={itemName}`
  - কাস্টমার বিশ্লেষণের ৪টা মিনি-লিস্ট (শীর্ষ অর্ডার/টাকা/বকেয়া/নিষ্ক্রিয়)
    → `/dashboard/customers/{customerId}`
  - স্টাফ কর্মক্ষমতা টেবিলের সারি → `/dashboard/orders?staffId={staffId}`
  - খরচ বিশ্লেষণ পাই চার্টের ক্যাটাগরি লিস্ট → `/dashboard/expenses?category={categoryId}`
    (মাসওয়ারি ট্রেন্ড বার চার্ট ইচ্ছাকৃতভাবে ক্লিকযোগ্য করা হয়নি — রিপোর্ট
    পেজের রেঞ্জ ও চার্টের নির্দিষ্ট মাসের জন্য আলাদা কোনো সরল টার্গেট পেজ নেই)
  নতুন URL param সাপোর্ট যোগ হয়েছে (আগের `filter=`/`status=` প্যাটার্ন
  অনুসরণ করে): অর্ডার পেজে `?q=` ও `?staffId=`, খরচ পেজে `?category=`
  (খরচ পেজে এই কারণে `useSearchParams` + `Suspense` wrapper যোগ হয়েছে,
  অর্ডার পেজের মতোই)। কোনো নতুন translation key লাগেনি (শুধু নেভিগেশন) —
  i18n parity স্ক্রিপ্টে যাচাই করা হয়েছে, কোনো mismatch নেই।
- ✅ সেশন ৭: সুপার এডমিন রিপোর্ট ড্রিলডাউন — `/super-admin/reports`-এ
  নতুন "টেন্যান্টওয়ারি আয়" টেবিল (activation সংখ্যা + মোট আয়) যোগ, রো
  ক্লিকে মাসওয়ারি payment history মোডাল (কোনো নতুন Firestore read ছাড়াই,
  বিদ্যমান collectionGroup fetch থেকে group করে)। ড্যাশবোর্ড KPI কার্ড
  ক্লিকযোগ্য করার আইটেম রিভিউতে দেখা গেছে আগে থেকেই তৈরি ছিল — নতুন কোড
  লাগেনি। বিস্তারিত `MODULE_README.md`।
- 🟡 সেশন ৮ (আংশিক, ব্যবহারকারীর স্ক্রিনশট-রিভিউ শেষে আপডেট): মোবাইল
  রেসপন্সিভ অডিট। শেয়ার্ড কম্পোনেন্টে ৩টা বাগ ফিক্স (Dialog/AlertDialog
  edge-to-edge, KPI কার্ড overflow) + সুপার-অ্যাডমিন শেলে `p-8` ফিক্সড
  প্যাডিং ফিক্স। **গুরুত্বপূর্ণ ওপেন প্রশ্ন:** ব্যবহারকারী একটা ফোন
  স্ক্রিনশট দেখিয়েছেন যেখানে সুপার-অ্যাডমিন সাইডবার মোবাইলে পুরোপুরি
  দেখাচ্ছিল (ভাঙা) — কোড-রিভিউতে `SuperAdminSidebar.tsx`/
  `SuperAdminMobileNav.tsx`-এ সঠিক `hidden lg:flex`/`lg:hidden` প্যাটার্ন
  পাওয়া গেছে, তাই বর্তমান কোড অনুযায়ী এটা ভাঙার কথা না — সম্ভবত স্ক্রিনশট
  পুরনো/আন-ডিপ্লয়েড বিল্ড থেকে। ব্যবহারকারীকে লাইভ সাইটে hard-refresh
  করে আবার চেক করতে বলা হয়েছে; এখনো নিশ্চিত হয়নি। বিস্তারিত
  `MODULE_README.md`।
- ⬜ সেশন ৯: সুপার এডমিন থেকে পার্মানেন্ট টেন্যান্ট ডিলিট (সবচেয়ে
  ঝুঁকিপূর্ণ, সবার শেষে) — কোডিং সম্পন্ন হয়েছে (নিচে বিস্তারিত), কিন্তু
  এখনো ⬜ (না ✅) রাখা হলো কারণ **ব্যবহারকারীর emulator-এ ম্যানুয়াল টেস্ট
  বাকি** (SETUP-TESTING.md → "ধাপ ৭.৫" দেখুন) — এই একটা আইটেম শুধু কোড-
  রিভিউতে ✅ করার মতো ঝুঁকি না, তাই টেস্ট কনফার্ম হওয়ার পর ✅ করা হবে।
  - নতুন Admin SDK route `app/api/super-admin/delete-tenant/route.ts`:
    super_admin ভেরিফিকেশন, সার্ভার-সাইড আবার নাম-মিলিয়ে-কনফার্ম, ডেটা
    মোছার আগে top-level `tenant_deletion_log`-এ স্থায়ী রেকর্ড, তারপর
    `db.recursiveDelete(tenantRef)` (Firestore Admin SDK-এর নিজস্ব
    রিকার্সিভ ডিলিট — tenant ডকুমেন্ট + যেকোনো গভীরতার সব সাবকালেকশন,
    হাতে কালেকশন-নাম তালিকা করার চেয়ে বেশি নিরাপদ, ভবিষ্যতে নতুন
    সাবকালেকশন যোগ হলেও কোড না বদলেই কভার হবে), তারপর tenant_admin +
    সব স্টাফের Firebase Auth user ডিলিট (best-effort)।
  - নতুন client ফাংশন `deleteTenantPermanently()`
    (`lib/firebase/tenants.ts`) — activateTenant()/setTenantSuspended()-এর
    best-effort সাইড-কল প্যাটার্নের বিপরীতে, এখানে পুরো কাজটাই API
    route-এ হয় বলে এই ফাংশন ব্যর্থতা throw করে (গিলে ফেলে না)।
  - নতুন `DeleteTenantModal.tsx` — টেন্যান্টের নাম হুবহু টাইপ-করে-কনফার্ম
    (generic `ConfirmDialog` না, ফ্রি-টেক্সট ইনপুট দরকার বলে), red/
    destructive স্টাইল, `preventOutsideClose`।
  - `TenantActionsMenu.tsx`-এ নতুন "স্থায়ীভাবে ডিলিট করুন" মেনু-আইটেম
    (আলাদা visual weight সহ, Suspend-এর সাথে ভুলে গুলিয়ে ফেলার ঝুঁকি
    কমাতে), `tenants/page.tsx`-এ state+modal wiring।
  - i18n: `sa.deleteTenant.*` ও `sa.tenants.actions.delete` — bn/en দুই
    ফাইলেই যোগ হয়েছে, valid JSON হিসেবে যাচাই করা হয়েছে।
  - `firestore.rules` পরিবর্তন লাগেনি — বিদ্যমান ব্ল্যাঙ্কেট
    `match /{document=**} { allow read, write: if isSuperAdmin(); }`
    rule নতুন `tenant_deletion_log` কালেকশনও কভার করে।

---

## 🟢 সম্পন্ন — "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচার (ধাপ ১-৮ সব হয়েছে, ১টা খোলা প্রশ্ন বাকি)

**সর্বশেষ যোগ হলো:** ১৭ আগস্ট ২০২৬। ৮-ধাপের পুরো পরিকল্পনা এই দুই
সেশনে সম্পন্ন হয়েছে। বিস্তারিত `MODULE_README.md`-এ।

- ✅ ধাপ ১: `supplier_transactions` itemized ডেটা-কাঠামো + `recordItemizedSupplierPurchase()`
- ✅ ধাপ ২: `TransactionItemRows`/`TransactionFinancialFields` শেয়ার্ড কম্পোনেন্ট
- ✅ ধাপ ৩: `purchase-form.tsx` ("ক্রয় করুন" ফর্ম)
- ✅ ধাপ ৪: সাপ্লায়ার-তৈরি ফর্মে "ইনি একই সাথে আমার কাস্টমারও" checkbox
- ✅ ধাপ ৫: সাপ্লায়ার প্রোফাইলে "কাস্টমার বানান" বাটন
- ✅ ধাপ ৬ (আংশিক নীতিগত সিদ্ধান্তসহ): দ্বৈত প্রোফাইল পেজে "বিক্রি করুন"/
  "ক্রয় করুন" বাটন জোড়া বসানো হয়েছে। **কিন্তু পরিকল্পনার "সম্মিলিত
  লেনদেনের ইতিহাস টেবিল" (merged order+payment+supplier-ledger, running
  নিট ব্যালেন্স সহ) বানানো হয়নি** — কারণ `linked-profile-banner.tsx`-এ
  আগে থেকেই একটা ইচ্ছাকৃত ডিজাইন-সিদ্ধান্তের কমেন্ট আছে যে তিন রকম
  ভিন্ন sign-convention-এর ডেটা merge করা আর্থিক-সঠিকতার ঝুঁকি তৈরি করে,
  তাই বদলে পাশাপাশি বকেয়া+নিট-অবস্থান ব্যানার রাখা হয়েছে। এই সেশনে
  ব্যবহারকারীর কাছে এই conflict স্পষ্টভাবে তোলা হয়েছিল; স্পষ্ট
  নিশ্চিতকরণ ছাড়া আর্থিক-হিসাবের ঝুঁকিপূর্ণ পরিবর্তনে না গিয়ে রক্ষণশীল
  পথ (বিদ্যমান ব্যানার বহাল রাখা) বেছে নেওয়া হয়েছে। **পরের সেশনে
  ব্যবহারকারীর সাথে confirm করে যেকোনো দিকে এগোনো যাবে** — merge টেবিল
  চাইলে sign-convention স্পষ্টভাবে ঠিক করে বানাতে হবে (বিক্রি +, কাস্টমার-
  পেমেন্ট −, ক্রয় −, সাপ্লায়ার-পেমেন্ট +)।
- ✅ ধাপ ৭: `firestore.rules` — line-by-line যাচাই করা হলো (customers/
  suppliers/supplier_transactions তিনটা rule block-ই পুরোপুরি পড়ে
  confirm করা হয়েছে, শুধু ধারণা নয়): `customers` create-এ, `suppliers`
  create+update-এ, `supplier_transactions` create-এ — কোনোটাতেই এই
  ফিচারের নতুন কোনো write pattern block হচ্ছে না। `customers` update-এর
  কড়া `.hasOnly()` restriction আছে ঠিকই, কিন্তু এই ফিচারের কোনো কোড
  customer ডকুমেন্ট update করে না (শুধু create করে) — তাই এটা প্রভাবিত
  করে না। **কোনো rules পরিবর্তন লাগেনি, ধাপ ৭ সম্পূর্ণ।**
- ✅ ধাপ ৮: চূড়ান্ত `tsc --noEmit` + `next lint` + i18n-parity — সব
  ক্লিন। ZIP ডেলিভার করা হয়েছে।

---

## ✅ সম্পন্ন (১৭ আগস্ট ২০২৬, সম্প্রসারিত সেশন)

### orders + customers/items/quotations/suppliers/stock/outsource — সব master-list-এ pagination fix
- আগে শুধু orders ফিক্স হয়েছিল (নিচের এন্ট্রি দেখুন); একই সেশনে বাকি ৬টা
  collection-এও একই `fsLimit(500)`-নীরব-ড্রপ বাগ পাওয়া গেছে ও ফিক্স হয়েছে।
- নতুন reusable `lib/firebase/pagination-helpers.ts`, প্রতিটা list পেজে
  "আরও লোড করুন" বাটন + সতর্কতা ব্যানার।


### 🔴→✅ commission.ts ও expenses.ts-এর আর্থিক-সঠিকতা বাগ (নতুন আবিষ্কার, একই সেশনে ফিক্স)
- **এটা আগের pagination ফিক্সের চেয়ে বেশি গুরুতর ছিল:** `subscribeOrdersForCommission`/
  `subscribeExpenses` all-time ডেটা ৫০০-তে ক্যাপ করে আনত, আর commission/
  my-commission/expenses পেজ সেই capped ডেটার ওপর client-side মাস-ফিল্টার
  করত — ৫০০+ সারাজীবনের অর্ডার/খরচ থাকা টেন্যান্টে পুরনো মাস সিলেক্ট করলে
  **নীরবে ভুল/অসম্পূর্ণ কমিশন বা খরচের সংখ্যা** দেখাত।
- **ফিক্স:** নতুন `subscribeOrdersForCommissionMonth`/`subscribeExpensesForMonth`
  — সরাসরি Firestore `where(date >=, <)` date-range query, কোনো cap ছাড়াই
  (pagination না, কারণ সমস্যাটা pagination-এর না — সঠিক query scope-এর)।
- Dashboard KPI (`subscribeMonthExpenses`) প্রভাবিত হয়নি — ইতিমধ্যে সঠিক ছিল।
- **বিস্তারিত:** `MODULE_README.md` → "সেশন সম্প্রসারণ: ~৯টা master-list-এ
  pagination + commission/expenses date-range fix (১৭ আগস্ট ২০২৬)"।

### ⚠️ এই সেশনেই আবিষ্কৃত কিন্তু এখনো ফিক্স করা হয়নি (নতুন আইটেম, নিচে যোগ করা হলো)
- ~~`subscribeStaffWithdrawals`/`subscribeMyWithdrawals` (commission.ts)-এ
  কোনো Firestore cap-ই নেই~~ **✅ ফিক্স হয়েছে (একই দিনের পরের সেশনে)** —
  দেখুন `MODULE_README.md` → "সেশন সম্প্রসারণ #২: staff_withdrawals-এর
  unbounded query ফিক্স"।

- **ভেরিফিকেশন (সব সম্প্রসারণ শেষে):** `tsc --noEmit` ও `next lint`
  দুটোই ০ এরর (১টা পূর্বপরিচিত warning ছাড়া)। i18n parity ১০০%।

---

## 🔴 জরুরি — ব্লকিং

### ০. Firestore rules emulator-টেস্ট বাকি (১৬ আগস্ট ২০২৬ audit-fix সেশনের পর)
- এই সেশনে `firestore.rules`-এ DATA-001 (customers), DATA-002 (items),
  FIN-002 (`lastPaymentId`) ফিক্স করা হয়েছে — সবগুলো নতুন `.hasOnly()`/
  `.get()` শর্ত-সহ। sandbox-এ Firebase CLI/emulator উপলব্ধ না থাকায়
  শুধু static code review করা হয়েছে, **runtime emulator টেস্ট হয়নি**।
- ডিপ্লয়ের আগে অন্তত একবার emulator দিয়ে বা staging-এ টেস্ট করুন:
  কাস্টমার এডিট (tenant_admin/branch_manager দিয়ে — কাজ করা উচিত),
  staff দিয়ে কাস্টমার এডিটের চেষ্টা (আটকানো উচিত), আইটেম এডিট +
  staff দিয়ে নতুন সাইজ/কালার যোগ, এবং একটা payment record + একটা
  pure status-update — দুটোই স্বাভাবিকভাবে কাজ করছে কিনা।
- বিস্তারিত: `MODULE_README.md` → "External Audit Fix Session — ১৬
  আগস্ট ২০২৬"।

### ০.৫ পেমেন্ট-ক্যাসকেড ব্যাকফিল — Firestore rules ডিপ্লয়ের **আগে** চালাতে হবে
(সেশন ২, ১৮ আগস্ট ২০২৬) `firestore.rules`-এ payments update rule এখন
`resource.data.deletedAt == null` চেক করে — পুরনো payment ডকুমেন্টে
(এই সেশনের আগে রেকর্ড হওয়া) `deletedAt` ফিল্ডই নেই, তাই rules deploy
হয়ে গেলে ও `scripts/backfill-payments-deleted-at.js --apply` **না**
চালালে: (ক) সেই পুরনো payment গুলো payments লিস্ট/রিপোর্ট/ড্যাশবোর্ড/
কাস্টমার-প্রোফাইল থেকে সব জায়গায় হঠাৎ অদৃশ্য দেখাবে (নতুন
`where("deletedAt","==",null)` কুয়েরি তাদের বাদ দেবে), (খ) সেই পুরনো
অর্ডারগুলো ডিলিট করলে cascade সফট-ডিলিট rules-এ আটকে যাবে। **ক্রম:**
১. `node scripts/backfill-payments-deleted-at.js` (dry-run, কতজন
আক্রান্ত দেখুন) → ২. `--apply` দিয়ে আসল ব্যাকফিল → ৩. তারপর
`firebase deploy --only firestore:rules,firestore:indexes`। বিস্তারিত
`MODULE_README.md` → "ইউজার-রিপোর্টেড ফিডব্যাক — সেশন ২"।

### ০.৭ সেশন ২-এর নতুন Firestore ইনডেক্স — ডিপ্লয় বাকি
`firestore.indexes.json`-এ payments কালেকশনের ৫টা বিদ্যমান কম্পোজিট
ইনডেক্স আপডেট (মাঝে `deletedAt ASC` যোগ) ও ২টা নতুন ইনডেক্স
(`deletedAt ASC + paymentDate ASC/DESC`, branchId="সব শাখা" কেসের জন্য)
যোগ হয়েছে। উপরের ০.৫-এর সাথে একই `firebase deploy --only
firestore:rules,firestore:indexes` কমান্ডেই ডিপ্লয় হবে — ইনডেক্স
তৈরি হতে (ডেটার আকারভেদে) কিছুক্ষণ সময় লাগতে পারে, তাই ডিপ্লয়ের পরপরই
পেমেন্ট পেজ টেস্ট না করে কয়েক মিনিট অপেক্ষা করা ভালো।

### ০.৮ সেশন ৫-এর `firestore.rules` ফিক্স — ডিপ্লয় বাকি (প্রোফাইল ছবি আপলোড)
`tenants/{tenantId}/users/{userId}` self-update rule-এর allowlist-এ
`avatarUrl` যোগ হয়েছে (আগে শুধু `name`/`updatedAt` অনুমোদিত ছিল)। এই
rules ডিপ্লয় না হওয়া পর্যন্ত branch_manager/commission_staff/
regular_staff — এই তিন রোলের কেউ প্রোফাইল পেজ থেকে ছবি আপলোড করতে
পারবেন না (Cloudinary আপলোড ও Auth photoURL আপডেট সফল হবে, কিন্তু
Firestore mirror-write `permission-denied` দিয়ে ব্যর্থ হবে, ব্যবহারকারী
এরর টোস্ট দেখবেন)। tenant_admin প্রভাবিত না (আলাদা rule পাথ, আগে থেকেই
কাজ করে)। উপরের ০.৫/০.৭-এর মতো একই `firebase deploy --only
firestore:rules,firestore:indexes` কমান্ডেই যাবে। বিস্তারিত
`MODULE_README.md` → "সেশন ৫ — sticky sidebar/topbar রিভিউ + প্রোফাইল
ছবি আপলোড firestore.rules ফিক্স"।


- **আসল কারণ (১৫ আগস্ট ২০২৬ সেশনে চিহ্নিত):** `app/api/auth/signup/route.ts`
  ও `app/api/super-admin/create-tenant/route.ts` — কোনো tenant-তৈরির
  রুটই কখনো ডিফল্ট `branches/{branchId}` ডকুমেন্ট তৈরি করত না। একক-মালিক
  টেন্যান্ট (কোনো স্টাফ/শাখা যোগ করেননি — সবচেয়ে সাধারণ কেস) তাই
  branchId ছাড়া থেকে যেতেন, এবং `lib/validations/order.ts`/`quotation.ts`-এ
  branchId হার্ড-রিকোয়ার্ড থাকায় অর্ডার/কোটেশন তৈরি করতে পারতেন না।
  পুরনো v42 ফিক্স (branchId হিডেন-ফিল্ড বাগ) সঠিক ছিল কিন্তু ভিন্ন একটা
  উপসর্গের জন্য — এই মূল কারণটা তখন ধরা পড়েনি।
- **কী ফিক্স করা হয়েছে এই সেশনে:** signup route দুটোতে ডিফল্ট "প্রধান
  শাখা" অটো-তৈরি, order/quotation ভ্যালিডেশন + costing সেভ হ্যান্ডলারে
  defense-in-depth, settings-এ branch ট্যাব unlock (স্ব-নিরাময়ের জন্য),
  আক্রান্ত পুরনো টেন্যান্টদের জন্য ঐচ্ছিক one-time backfill script।
  বিস্তারিত `MODULE_README.md`-এর "শূন্য-শাখা / একক-মালিক বাগ ফিক্স"
  সেকশনে।
- **এখনো বাকি:** নিচের #২ ডিপ্লয়মেন্ট আইটেম না হওয়া পর্যন্ত এই ফিক্স
  লাইভ সাইটে কার্যকর হবে না। ডিপ্লয়ের পর একটা টেস্ট সাইনআপ (কোনো
  শাখা/স্টাফ যোগ না করে) দিয়ে সরাসরি অর্ডার তৈরি করে end-to-end
  নিশ্চিত করা উচিত।

### ২. ডিপ্লয়মেন্ট — Netlify ও Firebase দুটোই বাকি
- **v42 থেকে বর্তমান (শূন্য-শাখা ফিক্স সহ) পর্যন্ত** কোনো ভার্সনই এখনো
  লাইভ সাইটে ডিপ্লয় করা হয়েছে বলে নিশ্চিত হওয়া যায়নি।
- **Netlify (অ্যাপ কোড):** `git add . && git commit -m "..." && git push`
- **Firebase (rules + indexes):**
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes
  ```
- **কেন গুরুত্বপূর্ণ:** rules ডিপ্লয় না হলে নতুন ফিচার দুটো ভাঙবে —
  (ক) স্টাফ অর্ডার "Delivered" করতে পারবেন না (`deliveredAt` ফিল্ড
  rules-এর allowlist-এ নেই পুরনো rules-এ), (খ) স্টাফ অর্ডারে নতুন
  সাইজ/কালার টাইপ করে যোগ করতে পারবেন না (items rules-এ staff exception
  নেই পুরনো rules-এ)।

---

## 🟡 মাঝারি — শীঘ্রই করা ভালো

### ৩. `getAfter()` পেমেন্ট Security Rule — emulator টেস্ট বাকি
- **ফাইল:** `firestore.rules`, orders match block (payment-linked
  dueAmount-হ্রাস rule)
- **কেন:** এই rule-টা কখনো Firebase local emulator-এ verify করা হয়নি।
  প্রোডাকশনে সম্পূর্ণ নির্ভরযোগ্য কিনা নিশ্চিত না। (১৬ আগস্ট ২০২৬:
  এই সেশনে একই ব্লকে আরও নতুন rule-শর্ত যোগ হয়েছে — উপরে #০ দেখুন,
  একসাথে টেস্ট করাই ভালো।)
- **কীভাবে:** `firebase emulators:start`, তারপর emulator UI দিয়ে একটা
  payment রেকর্ড করে দেখা dueAmount ঠিকভাবে কমছে কিনা এবং rule কোনো
  বৈধ write ভুল করে block করছে না।
- **কে করবে:** শুধু ব্যবহারকারীর লোকাল এনভায়রনমেন্টে সম্ভব, Claude করতে
  পারবে না।

### ৪. `firebase-admin` ১২→১৪ আপগ্রেড (npm audit-এর ৩৫টা vulnerability ফিক্সের জন্য প্রয়োজন)
- **প্রেক্ষাপট (১৬ আগস্ট ২০২৬, external audit DEVOPS-001):**
  `npm audit` ৩৫টা vulnerability দেখায় (১৬ high + ১৯ moderate), সবগুলোই
  `firebase-admin`-কে `^12.3.1` থেকে `14.2.0`-এ আপগ্রেড করলে (২-মেজর-
  ভার্সন জাম্প, `--force`, breaking change হিসেবে চিহ্নিত) ঠিক হবে।
  Non-force `npm audit fix` কিছুই ফিক্স করে না।
- **কেন এই সেশনে করা হয়নি:** প্রতিটা `app/api/*` route (SMS/Email/
  WhatsApp notification, signup, tenant creation ইত্যাদি) Admin SDK
  ব্যবহার করে — একটা ব্লাইন্ড ২-মেজর-ভার্সন জাম্প এই পুরো surface-কে
  ভাঙতে পারে, এবং sandbox-এ আসল Firebase-এর বিপরীতে regression টেস্ট
  করা সম্ভব না। এটা আগেও একবার স্থগিত রাখা হয়েছিল একই কারণে।
- **কীভাবে করা উচিত:** আলাদা, ডেডিকেটেড সেশনে — আপগ্রেড করে, প্রতিটা
  `app/api/*` route ম্যানুয়ালি টেস্ট করে (বিশেষত signup, order create,
  payment record, SMS/email/WhatsApp send), তারপর ডিপ্লয়।

---

## 🟢 ঐচ্ছিক — ভবিষ্যতের জন্য

### ৪. Item Variants — রিপোর্টে variant-ওয়ারি ব্রেকডাউন
- **সিদ্ধান্ত (১৩ আগস্ট ২০২৬):** ইচ্ছাকৃতভাবে **স্থগিত**। ফিচার এইমাত্র
  বানানো হয়েছে (v46-v47), এখনো বাস্তব ব্যবহারের ডেটা নেই। কয়েক
  সপ্তাহ/মাস স্বাভাবিক ব্যবহারের পর প্রকৃত প্যাটার্ন দেখে সিদ্ধান্ত নেওয়া
  ভালো — এখনই বানালে অনুমানের ওপর ডিজাইন করা হবে।
- **যখন করার সময় আসবে:** পুরো নতুন সেকশনের বদলে "drill-down" পদ্ধতি
  সুপারিশ করা হয়েছে — টপ-৫ লিস্ট আইটেম-নাম দিয়েই থাকবে (আগের মতো
  পরিষ্কার), ক্লিক করলে ভেতরে variant-ব্রেকডাউন এক্সপ্যান্ড হবে।

### ৫. লগইন পেজ — ব্যবহারকারীর নিজস্ব UI ডিজাইন
- ব্যবহারকারী নিজে একটা UI ডিজাইন বানিয়ে পাঠাবেন বলেছিলেন (এখনো
  পাঠাননি)। পেলে সেই অনুযায়ী auth-split-layout.tsx/login page আবার
  সাজানো হবে।

### ৬. Floating label ডিজাইন-প্যাটার্ন (auth পেজে প্রস্তাবিত ছিল, বাতিল)
- **সিদ্ধান্ত:** শুধু auth পেজে না করে — এটা করলে পুরো অ্যাপ থেকে auth
  পেজ ভিজ্যুয়ালি আলাদা/অসামঞ্জস্যপূর্ণ হয়ে যাবে (বাকি ২০+ ফর্মে label-
  উপরে-থাকা প্যাটার্ন)। যদি ভবিষ্যতে করতে হয়, **পুরো ডিজাইন-সিস্টেম জুড়ে**
  একটা আলাদা, পরিকল্পিত সেশন হিসেবে করা উচিত — auth পেজের patch হিসেবে
  না।

### ৭. `al-ihsan-printerp-showcase.html` — প্রয়োজনীয়তা যাচাই বাকি
- রুট ফোল্ডারে একটা ৫০KB standalone HTML ফাইল আছে যেটার উদ্দেশ্য নিশ্চিত
  না (মার্কেটিং শোকেস/ডেমো সম্ভবত)। মুছে ফেলার আগে ব্যবহারকারীর কাছে
  নিশ্চিত হওয়া দরকার এটা এখনো দরকারি কিনা।

### ৯. শেষ সক্রিয় শাখা নিষ্ক্রিয় করা আটকানোর সেফগার্ড
- **প্রেক্ষাপট (১৫ আগস্ট ২০২৬):** শূন্য-শাখা ফিক্সের অংশ হিসেবে settings-এ
  branch ট্যাব এখন সব প্ল্যানের জন্য খোলা। `toggle-branch-active-dialog.tsx`-এ
  কোনো সেফগার্ড নেই যা শেষ সক্রিয় শাখা নিষ্ক্রিয় করা আটকায় — একজন
  একক-মালিক ব্যবহারকারী ভুলবশত তার একমাত্র শাখা নিষ্ক্রিয় করে ফেললে আবার
  branchId-ছাড়া অবস্থায় ফিরে যাবেন (একই পুরনো সমস্যা)।
- **প্রস্তাবিত ফিক্স:** নিষ্ক্রিয় করার আগে active branch count চেক করে,
  ১টা হলে বাটন disable + একটা ব্যাখ্যা-টুলটিপ দেখানো।
- **স্ট্যাটাস:** এখনো কোড করা হয়নি, শুধু চিহ্নিত।

### ৮. `/about` (নির্মাতার পরিচিতি) পেজ — সম্পন্ন, ছোট কিছু follow-up বাকি
- **করা হয়েছে (১৩ আগস্ট ২০২৬):** `app/about/page.tsx` তৈরি হয়েছে,
  `middleware.ts`-এর PUBLIC_PATHS-এ যোগ হয়েছে, login/signup/trial-expired
  — তিন পেজের ফুটারেই লিংক বসানো হয়েছে।
- **করা হয়েছে (১৪ আগস্ট ২০২৬):** লগইন-করা ব্যবহারকারীদের জন্যও সাইডবারে
  (সবার নিচে, Settings-এর পরে) "নির্মাতার পরিচিতি" লিংক যোগ হয়েছে, সব
  রোলে দৃশ্যমান। পেজের "ফিরে যান" বাটন এখন `router.back()` (কনটেক্সট-
  সচেতন — সাইডবার থেকে এলে ড্যাশবোর্ডে ফেরত যাবে, লগইন পেজ থেকে এলে
  লগইনে)।
- **বাকি (ঐচ্ছিক):** A4 মার্কেটিং ব্রোশিওরে সংক্ষিপ্ত সংস্করণ যোগ করা
  যায়। প্রতিষ্ঠাতার একটা ছবি (অনুমতি নিয়ে) পেজে বসানো যেতে পারে, এখন
  শুধু টেক্সট। সুপার-অ্যাডমিন সাইডবারে যোগ করা হয়নি (ইচ্ছাকৃত — সম্ভবত
  প্রতিষ্ঠাতা নিজেই সুপার-অ্যাডমিন, প্রয়োজন নেই)।

---

## ⚪ বড়, নতুন মডিউল — শুরুই হয়নি

*(১৫ আগস্ট ২০২৬ অডিট আপডেট: এই সেকশনের আগের দাবি ভুল ছিল — পেমেন্টস পেজ ও
আউটসোর্স মডিউল দুটোই আসলে ইতিমধ্যে সম্পূর্ণ তৈরি, `MODULE_README.md`-এ
"কাজ ৩ — পেমেন্ট মডিউল" ও "কাজ ৭ — আউটসোর্স ট্র্যাকিং" সেশনে। এই ফাইলটা
তখন আপডেট করা হয়নি বলে ভুল তথ্য থেকে গিয়েছিল, নিচে ✅ তালিকায় সরানো হলো।)*

সত্যিকারের এখনো-শুরু-না-হওয়া বড় কাজ:

- **অর্ডার/কোটেশন এডিট ফিচার** — ব্লুপ্রিন্ট অংশ ৩.২-এ TENANT_ADMIN
  পারমিশনে "সম্পাদনা" (edit) আছে, কিন্তু `lib/firebase/orders.ts`/
  `quotations.ts`-এ শুধু status-বদল/reassign/delete/payment ফাংশন আছে —
  তৈরি হওয়ার পর আইটেম/দাম/ডিসকাউন্ট/কাস্টমার বদলানোর কোনো generic edit
  ফাংশন বা UI বাটনই নেই। ১৫ আগস্ট ২০২৬ অডিটে চিহ্নিত, কোনো কোড এখনো
  লেখা হয়নি।

---

## ✅ সম্প্রতি সম্পন্ন (রেফারেন্সের জন্য, সংক্ষেপে — ১৫ আগস্ট ২০২৬ অডিটে
যাচাই করে আপডেট করা হলো)

- v42: অর্ডার-ফর্ম branchId হিডেন-ফিল্ড বাগ ফিক্স, auth লেআউট
  ক্রাশ-বাগ ফিক্স
- v43-v44: লগইন পেজে wave-divider + মোবাইল ফিচার-স্ট্রিপ
- v45: "সরাসরি ডেলিভারড হিসেবে সেভ" টগল (সম্পূর্ণ, validation সহ)
- v46-v47: Item Variants ধাপ ১+২ (অর্ডার + কোটেশন ফর্মে creatable
  সাইজ/কালার dropdown, চালান/প্রিন্ট-ভিউতে প্রদর্শন) — **১৫ আগস্ট অডিটে
  পুনঃযাচাই: item master editor → order/quotation form → order detail →
  delivery challan পর্যন্ত সম্পূর্ণ end-to-end ওয়্যারড, কোনো প্ল্যান-লক
  নেই। প্রোডাকশনে না দেখা গেলে সেটা ডিপ্লয়মেন্ট বাকি থাকার কারণে (উপরে
  #২), অথবা কোনো আইটেমে এখনো ভ্যারিয়েন্ট গ্রুপ কনফিগার করা হয়নি বলে —
  কোড-বাগ না।**
- v47: ৪টা master-list-এ `fsLimit(500)` পারফরম্যান্স ফিক্স
- v48-v49: লগইন পেজ লেআউট-সোয়াপ (ব্র্যান্ড বাম, ফর্ম ডান), আইকন-only
  পাসওয়ার্ড টগল, প্রিমিয়াম মাইক্রো-ইন্টারঅ্যাকশন
- v50: "মনে রাখুন" চেকবক্স (Firebase persistence + সেশন-কুকি মেয়াদ)
- v51: `orderIdPrefix` ফরম্যাট অসামঞ্জস্য ফিক্স (legacy Cloud Function-এও)
- **পেমেন্ট মডিউল** (`/dashboard/payments`, T-05) — সম্পূর্ণ তৈরি
- **আউটসোর্স ট্র্যাকিং** (`/dashboard/outsource`, T-17, Premium-only) —
  সম্পূর্ণ তৈরি
- কস্টিং গাইডেড টেমপ্লেট (quick-start প্রিসেট)
- WhatsApp ইন্টিগ্রেশন Phase 1 (টেক্সট + পোর্টাল-লিংক, ম্যানুয়াল-ট্রিগার
  বাটন) — **Meta Business Manager-এ Message Template অনুমোদন +
  Netlify env var (৪টা) সেট না করা পর্যন্ত বাটন চাপলে স্পষ্ট এরর দেখাবে,
  কিছু পাঠাবে না — কোড বাকি না, বাহ্যিক সেটআপ বাকি**
- প্ল্যাটফর্ম-লেভেল লোগো আপলোড সিস্টেম + প্রিমিয়াম Auth-পেজ রিডিজাইন
  (split-screen), Suspended/Trial-expired পেজেও লোগো সামঞ্জস্য
- "নির্মাতার পরিচিতি" (/about) পেজ — dashboard-shell-এর ভেতরে + পাবলিক
  উভয় সংস্করণ, trial-contact বাটন (WhatsApp/Call/Email)
- শূন্য-শাখা / একক-মালিক বাগ ফিক্স (উপরে #১ বিস্তারিত)

বিস্তারিত পরিবর্তনের ইতিহাসের জন্য `MODULE_README.md` দেখুন — এই ফাইলটা
শুধু "কী বাকি" এর জন্য, "কী হয়েছে" এর সম্পূর্ণ ইতিহাসের জন্য না।
