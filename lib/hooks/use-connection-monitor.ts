"use client";

import { useEffect } from "react";
import { useConnectionStore } from "@/lib/stores/connection-store";

/**
 * Tracks browser connectivity and reflects it in the global connection store.
 * Firestore's own offline queue is transparent; this hook surfaces network
 * state so the navbar can show "সংযুক্ত" / "অফলাইন" per blueprint section 5.3.
 */
export function useConnectionMonitor(): void {
  const setOnline = useConnectionStore((s) => s.setOnline);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }

    setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);
}
