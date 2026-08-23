import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * lib/server/rate-limit.ts
 *
 * SECURITY FIX — audit item #2 (৩০ জুলাই ২০২৬): "কোনো route-এ rate
 * limiting নেই — বিশেষভাবে ঝুঁকিপূর্ণ: /api/auth/signup (spam signup),
 * /api/portal/track (orderNumber + phone brute-force)।"
 *
 * Fixed-window counter backed by Firestore. Two infra constraints rule
 * out the usual approaches: the Firebase plan here is Spark (no paid
 * add-ons — no Redis/Memorystore), and Netlify Functions are stateless
 * per invocation and may run on any of several concurrent instances, so
 * an in-process `Map` counter would silently under-count under real
 * traffic. Firestore is the one piece of shared, consistent storage this
 * app already has everywhere, so a transaction-incremented counter
 * document is the pragmatic choice here — one extra read+write per
 * rate-limited request, which is negligible next to the writes those
 * routes already perform.
 *
 * Each (key, windowStart) pair maps to one document at
 * `/rate_limits/{key}__{windowStart}`. This is a *fixed* window (not
 * sliding) — simpler, and sufficient for abuse-prevention rather than
 * precise throttling: a burst exactly at a window boundary can allow up
 * to ~2x the nominal limit in the worst case, which is an accepted
 * trade-off for the added complexity a sliding-window (or token-bucket)
 * implementation would need.
 *
 * Cleanup: old window documents are never explicitly deleted here — see
 * MODULE_README.md's "এখনো বাকি" list. A stray handful of small documents
 * per rate-limited key is a minor, bounded storage-cost issue, not a
 * functional one; a follow-up session should either add a scheduled
 * cleanup (mirroring hard-delete-expired-orders.mts's pattern) or set a
 * Firestore TTL policy on the `rate_limits` collection's `expiresAt`
 * field once this ships.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets — for a `Retry-After` header. */
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const db = getAdminDb();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  // Firestore document IDs can't contain "/" — sanitize just in case a
  // caller passes a key derived from a path-like value (e.g. an order
  // number that happens to contain one).
  const safeKey = key.replace(/[/\s]/g, "_");
  const ref = db.collection("rate_limits").doc(`${safeKey}__${windowStart}`);

  const count = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
    const next = current + 1;
    tx.set(
      ref,
      {
        count: next,
        windowStart,
        expiresAt: Timestamp.fromMillis(windowStart + windowMs),
      },
      { merge: true }
    );
    return next;
  });

  const windowEnd = windowStart + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd - now) / 1000));

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}

/** Standard 429 response body/headers for a rejected request. */
export function rateLimitResponseInit(result: RateLimitResult): ResponseInit {
  return {
    status: 429,
    headers: { "Retry-After": String(result.retryAfterSeconds) },
  };
}
