"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/**
 * Shared error handler for Firestore `onSnapshot()` listeners (via the
 * `subscribeX()` helpers in `lib/firebase/*.ts`).
 *
 * Previously, every `subscribeX(..., onError)` call site across the tenant
 * dashboard passed `() => undefined` or `() => setIsLoading(false)` as the
 * error callback — permission-denied, missing-index, and network errors were
 * silently swallowed and the user saw nothing but an empty list or a page
 * stuck on "loading". This hook fixes that by always surfacing a Bengali/
 * English toast, while still allowing the caller to run its own cleanup
 * (e.g. `setIsLoading(false)`) via the optional `onFinally` argument.
 *
 * Usage:
 *   const handleFirestoreError = useFirestoreErrorHandler();
 *   const unsub = subscribeToOrders(tenantId, filters, setOrders,
 *     handleFirestoreError(() => setIsLoading(false))
 *   );
 */
export function useFirestoreErrorHandler() {
  const t = useTranslations();

  return useCallback(
    (onFinally?: () => void) => (error: Error) => {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[Firestore onSnapshot error]", error);
      }
      toast.error(t("common.loadFailed"));
      onFinally?.();
    },
    [t]
  );
}
