"use client";

import { useEffect, type ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { Toaster } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getAuthUserFromFirebaseUser } from "@/lib/firebase/auth";
import { writeSessionCookie, clearSessionCookie } from "@/lib/firebase/session";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useConnectionStore } from "@/lib/stores/connection-store";

/**
 * Subscribes to Firebase Auth, keeps the global auth store in sync, and
 * writes the lightweight `printerp_session` cookie that middleware.ts reads
 * for the first, fast layer of route protection (blueprint section 11.3).
 * The authoritative trial/subscription check still happens client-side via
 * the live Firestore listener in app/(tenant)/layout.tsx.
 */
function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setOnline = useConnectionStore((s) => s.setOnline);

  useEffect(() => {
    setLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        clearSessionCookie();
        return;
      }
      try {
        const authUser = await getAuthUserFromFirebaseUser(firebaseUser);
        setUser(authUser);
        writeSessionCookie(authUser.claims);
      } catch {
        setUser(null);
      }
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(navigator.onLine);

    return () => {
      unsubscribeAuth();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setUser, setLoading, setOnline]);

  return null;
}

interface ProvidersProps {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthInitializer />
      {children}
      <Toaster
        position="top-right"
        richColors
        expand={false}
        duration={4000}
        toastOptions={{
          classNames: {
            toast: "font-sans text-sm",
          },
        }}
      />
    </NextIntlClientProvider>
  );
}
