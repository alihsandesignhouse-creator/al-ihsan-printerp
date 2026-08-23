'use client';

import { Printer } from 'lucide-react';
import { SuperAdminUserMenu } from './SuperAdminUserMenu';

/**
 * বাগ-ফিক্স (২১ আগস্ট ২০২৬, সুপার-অ্যাডমিন মোবাইল অডিট): ডেস্কটপ
 * SuperAdminSidebar.tsx-এ Logout বাটন ও ইউজার-ইমেইল থাকলেও সেই sidebar
 * `hidden lg:flex` — ১০২৪px-এর নিচে সম্পূর্ণ অদৃশ্য। SuperAdminMobileNav.tsx
 * (bottom-nav) শুধু ৫টা মূল মেনু আইটেম দেখায়, Logout নেই। ফলাফল: মোবাইলে
 * সুপার-অ্যাডমিনের লগআউট করার আক্ষরিক অর্থেই কোনো UI উপায় ছিল না।
 *
 * এই কম্পোনেন্ট শুধু মোবাইলে (`lg:hidden`) একটা sticky top bar দেখায় —
 * ব্র্যান্ড লোগো (বাম) + SuperAdminUserMenu (ডান, light variant, ডেস্কটপ
 * সাইডবার-ফুটারের সাথে একই কম্পোনেন্ট শেয়ার করে — ব্যবহারকারীর স্পষ্ট
 * পছন্দ অনুযায়ী দুই জায়গায় consistency)।
 */
export function SuperAdminMobileTopBar() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-2 lg:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-primary">
          <Printer className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </div>
      </div>
      <div className="w-48">
        <SuperAdminUserMenu variant="light" />
      </div>
    </header>
  );
}
