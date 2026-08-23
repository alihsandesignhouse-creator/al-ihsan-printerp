'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, LogOut, User } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * বাগ-ফিক্স (২১ আগস্ট ২০২৬, সুপার-অ্যাডমিন মোবাইল অডিট + ব্যবহারকারীর
 * ফিডব্যাক): আগে ডেস্কটপ সাইডবারের নিচে খালি ইমেইল-টেক্সট + Logout বাটন
 * প্লেইনভাবে বসানো ছিল, আর মোবাইলে এটা একদমই ছিল না। এখন tenant-side-এর
 * TopNavbar-এর অ্যাভাটার+ড্রপডাউন প্যাটার্নের সাথে সামঞ্জস্যপূর্ণ একটাই
 * শেয়ার্ড কম্পোনেন্ট — ডেস্কটপ সাইডবার-ফুটার ও মোবাইল টপ-বার দুই
 * জায়গাতেই ব্যবহৃত হয় (ব্যবহারকারীর স্পষ্ট পছন্দ: consistency)।
 *
 * `variant="dark"` (ডেস্কটপ সাইডবার, গাঢ় ব্যাকগ্রাউন্ডের ওপর, ড্রপডাউন
 * উপরের দিকে খোলে কারণ বাটনটা স্ক্রিনের একদম নিচে) বনাম
 * `variant="light"` (মোবাইল টপ-বার, সাদা ব্যাকগ্রাউন্ড, ড্রপডাউন নিচের
 * দিকে খোলে) — সুপার-অ্যাডমিনের কোনো "Profile" পেজ নেই (blueprint
 * SA-মডিউলে নেই), তাই ড্রপডাউনে শুধু Logout।
 */
export function SuperAdminUserMenu({ variant }: { variant: 'light' | 'dark' }) {
  const t = useTranslations('sa.nav');
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      router.push('/login');
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error(err);
    }
  };

  const isDark = variant === 'dark';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-neutral-700 hover:bg-neutral-100'
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isDark ? 'bg-white/15 text-white' : 'bg-brand-primary/10 text-brand-primary'
          }`}
        >
          <User className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{user?.email}</span>
        {isDark ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        )}
      </button>

      {open && (
        <>
          {/* বাইরে ট্যাপ করলে বন্ধ হওয়ার জন্য পূর্ণ-স্ক্রিন ওভারলে (অদৃশ্য) */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className={`absolute left-0 right-0 z-50 mx-1 rounded-lg border border-neutral-200 bg-white py-1 shadow-md ${
              isDark ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t('logout')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
