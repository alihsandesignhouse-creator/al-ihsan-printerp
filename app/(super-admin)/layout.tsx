'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthListener } from '@/lib/hooks/use-auth-listener';
import { useAuthStore } from '@/lib/stores/auth-store';
import { SuperAdminSidebar } from '@/components/super-admin/SuperAdminSidebar';
import { SuperAdminMobileNav } from '@/components/super-admin/SuperAdminMobileNav';
import { SuperAdminMobileTopBar } from '@/components/super-admin/SuperAdminMobileTopBar';

interface SuperAdminLayoutProps {
  children: ReactNode;
}

/**
 * AUDIT-REPORT-3.md Issue #3 fix: middleware.ts's role check only reads the
 * `printerp_session` cookie, which is written client-side (document.cookie)
 * and isn't signed — a forged cookie could get an unauthorized browser past
 * middleware into this route's shell. Firestore data itself was never at
 * risk (firestore.rules checks the real, server-verified custom claims on
 * request.auth.token, not this cookie), but the page shell had no
 * independent check of its own. `(tenant)/layout.tsx` already guards itself
 * this way (useAuthListener + a real claims check, redirecting unauthorized
 * users) — this mirrors that same established pattern for super-admin
 * routes, using the live Firebase Auth token (`user.claims.role`) instead
 * of the spoofable cookie.
 */
export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  useAuthListener();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user || user.claims.role !== 'super_admin') {
      router.replace('/login');
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user || user.claims.role !== 'super_admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <SuperAdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SuperAdminMobileTopBar />
        <main className="max-w-7xl flex-1 p-4 pb-20 sm:p-6 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>
      <SuperAdminMobileNav />
    </div>
  );
}
