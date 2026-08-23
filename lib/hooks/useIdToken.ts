import { useCallback } from 'react';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

/**
 * Returns a helper that retrieves the current user's Firebase ID token.
 * Always fetches a fresh token (forceRefresh: true) for Cloud Function calls
 * so custom claims are up-to-date.
 */
export function useIdToken() {
  const getToken = useCallback(async (): Promise<string> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    return getIdToken(currentUser, true);
  }, []);

  return { getToken };
}
