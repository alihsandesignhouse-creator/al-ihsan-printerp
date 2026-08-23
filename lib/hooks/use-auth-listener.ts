"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getAuthUserFromFirebaseUser } from "@/lib/firebase/auth";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * Subscribes to Firebase Auth state and keeps the global auth store in sync.
 * Mount once near the root of authenticated route groups.
 */
export function useAuthListener(): void {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }
      try {
        const authUser = await getAuthUserFromFirebaseUser(firebaseUser);
        setUser(authUser);
      } catch {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);
}
