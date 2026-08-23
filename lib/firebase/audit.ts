import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  startAfter,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db, auth } from "./client";
import type { AuthUser } from "@/lib/types/auth";
import type { AuditAction, AuditLog } from "@/lib/types/audit";

type AuthAction = "auth.login" | "auth.logout";

/**
 * Records a login/logout event to /tenants/{tenantId}/audit_logs, including
 * device (User-Agent) and IP (via /api/auth/client-ip — see that route's
 * docstring). Best-effort: never throws, since a failed audit write must
 * never block the sign-in/sign-out flow itself.
 *
 * Only meaningful for tenant-scoped users (tenant_admin, branch_manager,
 * commission_staff, regular_staff) — super_admin has no tenantId and no
 * accessible audit_logs path, so this is a no-op for them.
 */
export async function logAuthEvent(user: AuthUser, action: AuthAction): Promise<void> {
  const tenantId = user.claims.tenantId;
  if (!tenantId) return;

  try {
    let ipAddress = "";
    try {
      const res = await fetch("/api/auth/client-ip");
      if (res.ok) {
        const data = (await res.json()) as { ip?: string };
        ipAddress = data.ip ?? "";
      }
    } catch {
      // Non-critical — proceed without IP.
    }

    const ref = doc(collection(db, "tenants", tenantId, "audit_logs"));
    await setDoc(ref, {
      id: ref.id,
      tenantId,
      userId: user.uid,
      userEmail: user.email ?? "",
      action,
      resourceType: "auth",
      resourceId: user.uid,
      changes: {},
      ipAddress,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      createdAt: Timestamp.now(),
    });
  } catch {
    // Non-critical — never block login/logout on an audit-log failure.
  }
}

/**
 * Generic business-action audit writer — blueprint section ১১.৬: অর্ডার
 * তৈরি/সম্পাদনা/বাতিল/মুছে ফেলা, পেমেন্ট রেকর্ড, স্টাফ উত্তোলন, সেটিংস
 * পরিবর্তন। Called from the data-layer functions in orders.ts, expenses.ts,
 * commission.ts, tenant-settings.ts, and branches.ts, right after each
 * write succeeds.
 *
 * Deliberately reads `auth.currentUser` directly instead of taking the
 * caller's uid/email as parameters — every one of those data-layer
 * functions already runs inside an authenticated client session, so this
 * keeps the audit call a single extra line with no signature changes
 * (and no risk of an audit entry attributing an action to the wrong user
 * because a stale uid string was threaded through several calls).
 *
 * Best-effort and non-blocking, matching logAuthEvent: a failed audit
 * write must never roll back or surface an error for the business action
 * it is describing.
 */
export async function logAction(
  tenantId: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  changes: Record<string, unknown> = {}
): Promise<void> {
  const current = auth.currentUser;
  if (!current) return;

  try {
    const ref = doc(collection(db, "tenants", tenantId, "audit_logs"));
    await setDoc(ref, {
      id: ref.id,
      tenantId,
      userId: current.uid,
      userEmail: current.email ?? "",
      action,
      resourceType,
      resourceId,
      changes,
      ipAddress: "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      createdAt: Timestamp.now(),
    });
  } catch {
    // Non-critical — never block the calling write on an audit-log failure.
  }
}

// ─── Tenant Admin — full Audit Log viewer (blueprint ১১.৬ / SA-05 parity) ──

const AUDIT_PAGE_SIZE = 50;

export interface AuditLogPage {
  logs: AuditLog[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface FetchAuditLogsOptions {
  /** Narrows to a single Firestore resourceType (e.g. "order") — same-field
   *  query as the orderBy below, so no extra composite index needed beyond
   *  the one added for this filter. Pass null for "all categories". */
  resourceType?: string | null;
  /** Inclusive lower bound on createdAt. */
  from?: Date | null;
  /** Inclusive upper bound on createdAt. */
  to?: Date | null;
  /** Cursor from a previous page's `cursor`, for "আরও দেখুন" pagination. */
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}

/**
 * Paginated read of the full tenant audit log — only reachable by
 * tenant_admin per firestore.rules ("Tenant Admin reads the full log; any
 * active user may read their own entries only"). Ordered newest-first.
 *
 * resourceType filtering is done server-side (needs the composite index
 * added to firestore.indexes.json: resourceType ASC + createdAt DESC).
 * The finer-grained action filter (e.g. "order.status_changed" specifically)
 * is intentionally left to the caller to apply client-side on the returned
 * page — one composite index per category keeps this module's index-file
 * footprint small while still giving fast, indexed category filtering.
 */
export async function fetchAuditLogPage(
  tenantId: string,
  options: FetchAuditLogsOptions = {}
): Promise<AuditLogPage> {
  const colRef = collection(db, "tenants", tenantId, "audit_logs");
  const constraints = [] as ReturnType<typeof where>[];

  if (options.resourceType) {
    constraints.push(where("resourceType", "==", options.resourceType));
  }
  if (options.from) {
    constraints.push(where("createdAt", ">=", Timestamp.fromDate(options.from)));
  }
  if (options.to) {
    constraints.push(where("createdAt", "<=", Timestamp.fromDate(options.to)));
  }

  const baseQuery = query(colRef, ...constraints, orderBy("createdAt", "desc"), fsLimit(AUDIT_PAGE_SIZE));
  const finalQuery = options.cursor ? query(baseQuery, startAfter(options.cursor)) : baseQuery;

  const snap = await getDocs(finalQuery);
  const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog);
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;

  return {
    logs,
    cursor: lastDoc,
    hasMore: snap.docs.length === AUDIT_PAGE_SIZE,
  };
}
