import { collection, doc, updateDoc, onSnapshot, orderBy, query, Timestamp, type Unsubscribe } from "firebase/firestore";
import { getIdToken } from "firebase/auth";
import { auth, db } from "./client";
import { logAction } from "./audit";
import type { BranchFormData } from "@/lib/types/branch";
import type { Branch } from "@/lib/types/dashboard";

// AUDIT-REPORT-5.md Issue #2 fix (৪ আগস্ট ২০২৬): createBranch() below used
// to be documented as "no Cloud Function needed" and wrote directly via
// addDoc() — but that meant nothing anywhere enforced the blueprint's
// per-plan max-branches limit (অংশ ৪.৩). It now calls
// app/api/branches/create (Admin SDK) instead, same
// fetch()+Bearer-token+error-code-passthrough pattern already used by
// lib/firebase/users.ts's staffApiRequest() for staff creation.
interface BranchApiErrorBody {
  code?: string;
  message?: string;
}

class BranchFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "BranchFetchError";
  }
}

/**
 * Subscribes to ALL branches (active and inactive), for the T-09 branch
 * management screen where an admin needs to see and reactivate disabled
 * branches. Contrast with lib/firebase/dashboard.ts's subscribeBranches,
 * which filters to isActive==true only, for use in dashboard/order filters.
 */
export function subscribeAllBranches(
  tenantId: string,
  callback: (branches: Branch[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, "tenants", tenantId, "branches"), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch));
    },
    (error) => onError(error as Error)
  );
}

/**
 * Creates a new branch via app/api/branches/create (Admin SDK) — see the
 * AUDIT-REPORT-5 Issue #2 fix note above. firestore.rules now denies
 * client-side branches `create` entirely (edits/toggles on an *existing*
 * branch still go straight through updateBranch()/setBranchActive() below
 * — those can't increase the branch count, so they're unaffected).
 */
export async function createBranch(
  tenantId: string,
  data: BranchFormData
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new BranchFetchError("unauthenticated", "লগইন প্রয়োজন");
  const token = await getIdToken(currentUser, true);

  const res = await fetch("/api/branches/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone.trim(),
      branchManagerId: data.branchManagerId,
      isActive: data.isActive,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as BranchApiErrorBody;
    throw new BranchFetchError(body.code ?? "internal", body.message ?? "unknown");
  }

  const { branchId } = (await res.json()) as { branchId: string };
  return branchId;
}

export async function updateBranch(
  tenantId: string,
  branchId: string,
  data: BranchFormData
): Promise<void> {
  await updateDoc(doc(db, "tenants", tenantId, "branches", branchId), {
    name: data.name.trim(),
    address: data.address.trim(),
    phone: data.phone.trim() || null,
    branchManagerId: data.branchManagerId || null,
    isActive: data.isActive,
    updatedAt: Timestamp.now(),
  });
  void logAction(tenantId, "branch.updated", "branch", branchId, { name: data.name.trim() });
}

/** Soft toggle only — branches are never hard-deleted (blueprint rule). */
export async function setBranchActive(
  tenantId: string,
  branchId: string,
  isActive: boolean
): Promise<void> {
  await updateDoc(doc(db, "tenants", tenantId, "branches", branchId), {
    isActive,
    updatedAt: Timestamp.now(),
  });
  void logAction(tenantId, isActive ? "branch.activated" : "branch.deactivated", "branch", branchId, {});
}
