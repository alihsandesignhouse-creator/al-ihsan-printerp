# UI/UX অডিট রিপোর্ট — মোবাইল-রেসপন্সিভনেস, i18n হার্ডকোডিং, Overflow/Accessibility

সূত্র: ব্যবহারকারীর আপলোড করা ৭-ইস্যু প্রম্পট (অন্য একটা আগের অডিটে পাওয়া)। প্রতিটা ইস্যু কোড পড়ে যাচাই করা হয়েছে, তারপর সব কটা ফিক্স করা হয়েছে।

## Critical

**#1 — SuperAdminSidebar + layout: breakpoint গার্ড ছাড়া ফিক্সড ২৫৬px সাইডবার**
- ফাইল: `components/super-admin/SuperAdminSidebar.tsx:51`, `app/(super-admin)/layout.tsx`
- সমস্যা: `<aside>` `fixed left-0 top-0 h-screen w-64 ... z-40` — কোনো `hidden lg:flex` গার্ড নেই; `<main>` এ `ml-64` কোনো রেসপন্সিভ প্রিফিক্স ছাড়া। মোবাইল/ট্যাবলেটে পুরো Super Admin প্যানেল ভাঙা।
- ফিক্স: tenant `Sidebar.tsx`-এর হুবহু প্যাটার্ন (`sticky top-0 hidden ... lg:flex`, flex-ভিত্তিক layout, কোনো `ml-*` না) কপি করা হয়েছে। সাইডবার মোবাইলে লুকানোর ফলে navigation যাতে শূন্য না হয়ে যায়, তাই নতুন `SuperAdminMobileNav.tsx` (bottom nav, ৫টা আইটেম, `lg:hidden`) যোগ করা হয়েছে — একই `NAV_ITEMS` ডেটা reuse করে (নতুন কোনো ডুপ্লিকেট তালিকা না)।

**#2 — মোবাইল বটম-ন্যাভের "Menu" ডেড লিংক**
- ফাইল: `components/tenant/layout/mobile-bottom-nav.tsx:49` (আগের), `app/(tenant)/dashboard/menu/` (কখনো ছিল না)
- সমস্যা: `<Link href="/dashboard/menu">` — এই রুট প্রজেক্টে নেই। ফলে মোবাইল/ট্যাবলেটে ১৪টা সেকশন (Payments, Items, Costing, Commission, ...) নেভিগেট করার কোনো উপায় ছিল না।
- ফিক্স: ব্লুপ্রিন্ট সেকশন ১৪.৯ আসলে এই আইকনটাকে সবসময় *মেনু খোলার* বাটন হিসেবে বোঝাত, পেজ-নেভিগেশন না — এখন এটা একটা বাটন যা `MobileMoreMenu` (নতুন `mobile-more-menu.tsx`, Dialog-ভিত্তিক) খোলে, যেটা desktop `Sidebar.tsx`-এর হুবহু `NAV_SECTIONS` + `isNavItemVisible` role/plan-filter reuse করে (দুটো নেভ কখনো out-of-sync হবে না — একটাতে সেকশন যোগ করলে দুটোতেই হবে)।

## High

**#3 — SuperAdminSidebar-এ হার্ডকোডেড "লগআউট"**
- ফাইল: `components/super-admin/SuperAdminSidebar.tsx:98`
- সমস্যা: `t()` ছাড়া সরাসরি বাংলা টেক্সট — ইংরেজি locale-এও বাংলা দেখাত।
- ফিক্স: ইতিমধ্যে বিদ্যমান (কিন্তু আগে ব্যবহৃত হয়নি) `sa.nav.logout` key ব্যবহার করে `{t('logout')}`।

**#4 — CreateTenantModal-এ হার্ডকোডেড দাম-স্ট্রিং**
- ফাইল: `components/super-admin/CreateTenantModal.tsx:213-215`
- সমস্যা: `৳৯৯৯/মাস` ইত্যাদি হার্ডকোডেড — শুধু i18n সমস্যা না, এগুলো Super Admin-এর নিজের `EditPlanModal`-এ যেকোনো সময় বদলানো যায় এমন লাইভ, এডিটযোগ্য দামের সাথে sync-ই না — তাই দাম বদলালে এই মোডাল ভুল/পুরনো দাম দেখাত। ঠিক এই একই বাগ প্যাটার্ন আগে `ActivateTenantModal`/`EditTenantModal`-এ পাওয়া গিয়েছিল ও ফিক্স হয়েছিল (audit #৯) — এই মোডালটা তখন বাদ পড়েছিল।
- ফিক্স: সেই একই established fix প্যাটার্ন — `getSubscriptionPlansOnce()` দিয়ে লাইভ প্ল্যান-ক্যাটালগ fetch, `formatTaka()` দিয়ে locale-aware ফরম্যাট। নতুন key `sa.createTenant.perMonth` যোগ করা হয়েছে।

## Medium

**#5 — item-analysis-table.tsx-এ overflow/scroll handling মিসিং**
- ফাইল: `components/tenant/reports/item-analysis-table.tsx`
- সমস্যা: বাকি ১৭টা ডেটা-টেবিলের `overflow-x-auto` wrapper + `min-w-[...]` প্যাটার্ন এখানে ছিল না, শুধু `overflow-hidden` — ছোট স্ক্রিনে কনটেন্ট কেটে যেত, স্ক্রল করার সুযোগ ছিল না।
- ফিক্স: `branch-comparison-table.tsx`/`staff-performance-table.tsx`-এর হুবহু wrapper প্যাটার্ন (`overflow-hidden` বাইরের div → `overflow-x-auto` ভেতরের div → `min-w-[640px]` টেবিল) কপি করা হয়েছে।

**#6 — viewport-এ pinch-to-zoom বন্ধ (WCAG 1.4.4 লঙ্ঘন)**
- ফাইল: `app/layout.tsx`
- সমস্যা: `maximumScale: 1, userScalable: false`।
- ফিক্স: দুটোই সরানো হয়েছে — শুধু `width: 'device-width', initialScale: 1` রাখা হয়েছে।

## Low

**#7 — portal-invoice-view.tsx-এ overflow wrapper নেই**
- ফাইল: `components/portal/portal-invoice-view.tsx`
- সমস্যা: পাবলিক কাস্টমার-facing ইনভয়েস টেবিলে কোনো `overflow-x-auto` wrapper নেই — লম্বা আইটেম-নামে ছোট স্ক্রিনে কলাম চাপাচাপি করত।
- ফিক্স: `overflow-x-auto` + `min-w-[480px]` wrapper যোগ করা হয়েছে।

---

## যাচাই

সবগুলো ফিক্সের পর:
- `tsc --noEmit` — ০ error
- পুরো প্রজেক্ট `eslint` — ০ error (শুধু ২টা পুরনো, অসম্পর্কিত warning: `app/layout.tsx`-এর ফন্ট-লোডিং, `functions/src/tenantFunctions.ts`-এর console statement — কোনোটাই এই ফিক্সের সাথে সম্পর্কিত না)
- namespace-aware i18n চেক: bn/en key parity অক্ষত (১৩৮৭টা key প্রতিটাতে), ১৬৪২টা `t()` কলের একটাও missing key না

## যা করা হয়নি (দ্রষ্টব্য)

- আপলোড করা ডকুমেন্টের "ধাপ ১"-এ বলা **পূর্ণ deeper scan** (এই ৭টা ছাড়াও একই প্যাটার্নের আরও সমস্যা পুরো কোডবেসে আছে কিনা পুরোপুরি খোঁজা) এই সেশনে করা হয়নি — শুধু এই ৭টা যাচাই+ফিক্স করা হয়েছে, ব্যবহারকারীর সরাসরি নির্দেশ অনুযায়ী।
- মোবাইলে production-এ visually (ব্রাউজার/ডিভাইসে) রেন্ডার করে দেখা যায়নি — শুধু কোড-লেভেলে ক্লাস/স্ট্রাকচার সঠিক কিনা যাচাই করা হয়েছে, tsc/eslint দিয়ে।
- Super Admin panel-এর জন্য নতুন `SuperAdminMobileNav` একটা ন্যূনতম, স্কোপ-উপযোগী সংযোজন (৫টা আইটেম, কোনো role/plan filtering লাগে না) — tenant-এর মতো একটা "More" মেনুর প্রয়োজন হয়নি কারণ সবগুলো আইটেমই একসাথে বটম-ন্যাভে ফিট করে।
