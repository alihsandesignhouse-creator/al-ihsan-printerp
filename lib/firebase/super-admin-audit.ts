import {
  collectionGroup,
  collection,
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
import { db } from "@/lib/firebase/client";
import type { AuditLog } from "@/lib/types/audit";

/**
 * lib/firebase/super-admin-audit.ts — SA-05, Audit Log tab.
 *
 * Cross-tenant companion to lib/firebase/audit.ts's `fetchAuditLogPage`
 * (which is scoped to one tenant, for the tenant_admin-facing /dashboard/
 * audit-log page). This reads across every tenant's `audit_logs`
 * subcollection at once via a Firestore `collectionGroup` query — the
 * Super Admin's single feed of every important action on the whole
 * platform (order/payment/staff/settings/branch/auth events, plus tenant
 * lifecycle events like `tenant.activated` / `tenant.trial_expired` that
 * previously could only be seen one tenant at a time on the tenant detail
 * page's 30-entry preview).
 *
 * Access: covered by firestore.rules' blanket
 * `match /{document=**} { allow read, write: if isSuperAdmin(); }` —
 * recursive wildcards apply to collection-group queries too, so no new
 * rule is needed (only the composite/field-override indexes below).
 *
 * Indexes added to firestore.indexes.json for this query shape:
 *   - fieldOverrides: `audit_logs.createdAt`, queryScope COLLECTION_GROUP
 *     (serves the "all categories" case: collectionGroup + orderBy(createdAt)
 *     with no other filter)
 *   - composite index: collectionGroup "audit_logs", queryScope
 *     COLLECTION_GROUP, fields resourceType ASC + createdAt DESC (serves
 *     the category-filtered case — same field shape as the existing
 *     per-tenant COLLECTION-scope index, just widened to COLLECTION_GROUP)
 *
 * NOTE — scope decision (documented, see MODULE_README.md): Super-Admin-side
 * actions on `/platform_settings` (SA-05's contact-info tab) are NOT
 * written into any tenant's `audit_logs` and therefore do not appear in
 * this feed — there is no natural tenant to attach that event to. Only
 * tenant-scoped activity is covered here.
 */

const PAGE_SIZE = 50;

export interface CrossTenantAuditLogPage {
  logs: AuditLog[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface FetchCrossTenantAuditLogsOptions {
  resourceType?: string | null;
  from?: Date | null;
  to?: Date | null;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}

export async function fetchCrossTenantAuditLogPage(
  options: FetchCrossTenantAuditLogsOptions = {}
): Promise<CrossTenantAuditLogPage> {
  const colGroup = collectionGroup(db, "audit_logs");
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

  const baseQuery = query(colGroup, ...constraints, orderBy("createdAt", "desc"), fsLimit(PAGE_SIZE));
  const finalQuery = options.cursor ? query(baseQuery, startAfter(options.cursor)) : baseQuery;

  const snap = await getDocs(finalQuery);
  const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog);
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;

  return {
    logs,
    cursor: lastDoc,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

/**
 * tenantId → press name lookup, used by CrossTenantAuditTable to show which
 * press each row belongs to (a `collectionGroup` result only carries
 * `tenantId`, not the tenant's display name). Fetched once per page visit
 * and cached in-module for the session — the tenant list is small (every
 * tenant on the whole platform) and changes rarely enough that a
 * one-time fetch per Audit Log page visit is preferable to re-fetching on
 * every filter change or page-2 request.
 */
let cachedTenantNames: Promise<Map<string, string>> | null = null;

export function fetchTenantNameMap(): Promise<Map<string, string>> {
  if (!cachedTenantNames) {
    cachedTenantNames = getDocs(collection(db, "tenants")).then(
      (snap) => new Map(snap.docs.map((d) => [d.id, (d.data().name as string) ?? d.id]))
    );
    // Never cache a failed fetch — allow the next call to retry.
    cachedTenantNames.catch(() => {
      cachedTenantNames = null;
    });
  }
  return cachedTenantNames;
}
