# Module SA-02: Super Admin Tenant Management

## Overview

এই মডিউলে নিম্নলিখিত ফাইলগুলো আপনার বিদ্যমান Module 1 প্রজেক্টে যোগ করতে হবে।

---

## File Map — কোন ফাইল কোথায় যাবে

```
sa-02/
├── app/
│   ├── (super-admin)/
│   │   ├── layout.tsx                          → app/(super-admin)/layout.tsx
│   │   └── super-admin/
│   │       ├── dashboard/
│   │       │   └── page.tsx                    → app/(super-admin)/super-admin/dashboard/page.tsx
│   │       └── tenants/
│   │           ├── page.tsx                    → app/(super-admin)/super-admin/tenants/page.tsx
│   │           └── [tenantId]/
│   │               └── page.tsx                → app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx
│   └── api/
│       └── super-admin/
│           └── create-tenant/
│               └── route.ts                    → app/api/super-admin/create-tenant/route.ts
│
├── components/
│   └── super-admin/
│       ├── SuperAdminSidebar.tsx               → components/super-admin/SuperAdminSidebar.tsx
│       ├── KpiCard.tsx                         → components/super-admin/KpiCard.tsx
│       ├── TenantStatusBadge.tsx               → components/super-admin/TenantStatusBadge.tsx
│       ├── TenantActionsMenu.tsx               → components/super-admin/TenantActionsMenu.tsx
│       ├── CreateTenantModal.tsx               → components/super-admin/CreateTenantModal.tsx
│       ├── ActivateTenantModal.tsx             → components/super-admin/ActivateTenantModal.tsx
│       ├── EditTenantModal.tsx                 → components/super-admin/EditTenantModal.tsx
│       └── ConfirmDialog.tsx                   → components/super-admin/ConfirmDialog.tsx
│
├── lib/
│   ├── firebase/
│   │   └── tenants.ts                          → lib/firebase/tenants.ts
│   ├── hooks/
│   │   └── useIdToken.ts                       → lib/hooks/useIdToken.ts
│   ├── types/
│   │   └── tenant.ts                           → lib/types/tenant.ts
│   └── validations/
│       └── tenant.ts                           → lib/validations/tenant.ts
│
├── messages/
│   ├── bn.json                                 → merge into messages/bn.json (add "sa" key)
│   └── en.json                                 → merge into messages/en.json (add "sa" key)
│
├── functions/src/
│   └── tenantFunctions.ts                      → functions/src/tenantFunctions.ts
│
├── firestore.rules                             → merge into existing firestore.rules
└── firestore.indexes.json                      → merge into existing firestore.indexes.json
```

---

## Integration Steps

### 1. i18n Messages যোগ করুন

`messages/bn.json` এবং `messages/en.json`-এ `sa` key যোগ করুন:

```json
{
  "existing_key": "...",
  "sa": { ... }  // ← এই মডিউলের bn.json / en.json থেকে কপি করুন
}
```

### 2. Firestore Rules আপডেট করুন

বিদ্যমান `firestore.rules`-এ এই মডিউলের rules merge করুন। Helper functions (`isSuperAdmin`, `isTenantAdmin`, ইত্যাদি) ইতিমধ্যে Module 1-এ থাকলে duplicate করবেন না।

### 3. Firestore Indexes যোগ করুন

`firestore.indexes.json`-এর `indexes` array-এ এই মডিউলের indexes যোগ করুন।

### 4. Environment Variable যোগ করুন

`.env.local`-এ:
```env
CLOUD_FUNCTION_BASE_URL=https://asia-south1-YOUR_PROJECT_ID.cloudfunctions.net
```

### 5. Cloud Functions Deploy করুন

```bash
cd functions
npm install firebase-admin firebase-functions zod
npm run build
firebase deploy --only functions:onAdminCreateTenant,functions:onTenantSelfSignup,functions:checkTrialExpiry,functions:onTenantActivated
```

### 6. shadcn/ui Components নিশ্চিত করুন

এই মডিউলে ব্যবহৃত shadcn components (Module 1-এ না থাকলে):
```bash
npx shadcn-ui@latest add alert-dialog switch textarea table tabs
```

---

## কী তৈরি হয়েছে

### Pages
- `/super-admin/dashboard` — KPI cards, trial highlights, recent registrations
- `/super-admin/tenants` — Full tenant list with tab filters, search, actions
- `/super-admin/tenants/[tenantId]` — Tenant detail, subscription history, audit log, feature list

### Modals
- **CreateTenantModal** — Admin-created tenant with plan + date selection
- **ActivateTenantModal** — Trial → Paid, with package/duration/payment note; shows preview expiry date
- **EditTenantModal** — Edit all tenant fields + per-feature overrides (plan-included features shown as locked)
- **ConfirmDialog** — Reusable confirm for suspend/reactivate/enter panel

### Cloud Functions (functions/src/tenantFunctions.ts)
| Function | Trigger | কাজ |
|---|---|---|
| `onAdminCreateTenant` | HTTP POST | Auth user তৈরি + Firestore doc + custom claims |
| `onTenantSelfSignup` | HTTP POST | Trial signup — full premium features, 3-day trial |
| `checkTrialExpiry` | Scheduled (00:01 Asia/Dhaka) | Expired trial → status update + claims |
| `onTenantActivated` | Firestore onUpdate | Activated → custom claims আপডেট |

### Firebase Security Rules
- Super Admin: সব collection full access
- Tenant members: শুধু নিজের `/tenants/{tenantId}/...` read
- Tenant Admin: settings update (status fields ছাড়া)
- Audit logs, subscription_history: Cloud Functions only write
- Soft delete enforced (hard delete blocked)

---

## Architecture Notes

**tenantId is always the Firebase Auth UID** — Admin-created এবং self-signup উভয় ক্ষেত্রে `doc(db, 'tenants', uid)` ব্যবহার করা হয়। এতে custom claim-এর `tenantId` সবসময় UID-এর সাথে মেলে।

**Feature Overrides** — `planFeatures` = plan-এর default features। `featureOverrides` = plan-এর বাইরে Super Admin যা যোগ করেছেন। Effective features = `{ ...planFeatures, ...featureOverrides }`। Client-side `computeEffectiveFeatures()` এবং server-side উভয়তেই একই লজিক।

**Impersonation** — এখনো বাস্তবায়িত হয়নি। ব্লুপ্রিন্ট অংশ ৩.২ (SUPER_ADMIN
পারমিশন) অনুযায়ী ভবিষ্যতে "যেকোনো টেন্যান্টের প্যানেলে প্রবেশ (সাপোর্টের
জন্য)" ফিচারটা যোগ হবে, কিন্তু এখনো কোনো কোড নেই — কোনো UI বাটন নেই,
`impersonateTenantId`-এর কোনো রেফারেন্স কোডবেসে নেই। (DOC-001 ফিক্স, ১৬
আগস্ট ২০২৬ external audit: আগে এখানে একটা sessionStorage-ভিত্তিক flow ও
middleware token-swap বর্ণনা করা ছিল যেটা বাস্তবে কখনো implement হয়নি —
সেই stale বর্ণনাটা এই নোট দিয়ে প্রতিস্থাপন করা হলো, যাতে কেউ ভুল করে ভেবে
না নেয় এটা কাজ করছে।)
