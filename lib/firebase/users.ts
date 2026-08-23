import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getIdToken } from "firebase/auth";
import { auth, db } from "./client";
import type { PlanId } from "@/lib/types/tenant";
import type {
  CreateStaffPayload,
  CreateStaffResult,
  SetStaffActivePayload,
  StaffMember,
  UpdateStaffPayload,
} from "@/lib/types/user";

// ─── Read: live staff list for a tenant (optionally filtered by branch) ───
// Excludes soft-deleted records. tenant_admin's own row is never written
// here (only branch_manager / commission_staff / regular_staff), so the
// list is exactly the staff a Tenant Admin manages.
export function subscribeStaffMembers(
  tenantId: string,
  branchId: string | "all",
  callback: (staff: StaffMember[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "users");

  const q =
    branchId === "all"
      ? query(colRef, where("deletedAt", "==", null), orderBy("name", "asc"))
      : query(
          colRef,
          where("deletedAt", "==", null),
          where("branchId", "==", branchId),
          orderBy("name", "asc")
        );

  return onSnapshot(
    q,
    (snapshot) => {
      // Filter on the raw (untyped) role string *before* casting to
      // StaffMember — StaffRole structurally excludes 'tenant_admin' /
      // 'super_admin', so comparing against those after casting is a
      // compile-time impossible comparison (TS2367). Filtering the raw
      // Firestore data first is also the more correct defensive check,
      // since this doc's actual role is unverified until we've looked at it.
      const staff = snapshot.docs
        .filter((d) => {
          const rawRole = d.data().role as string;
          return rawRole !== "tenant_admin" && rawRole !== "super_admin";
        })
        .map((d) => ({ id: d.id, ...d.data() }) as StaffMember);
      callback(staff);
    },
    (error) => onError(error as Error)
  );
}

// ─── Read: tenant's planId + isTrial, used to display the staff-limit badge ──
// ─── Read: a single staff member's own document (T-12 commission rate lookup) ──
// commissionRate isn't in the Auth custom claims, so the staff commission
// pages (my-commission) read it directly off their own users/{uid} doc —
// firestore.rules already permits self-read (request.auth.uid == userId).
export function subscribeOwnStaffMember(
  tenantId: string,
  uid: string,
  callback: (staff: StaffMember | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "tenants", tenantId, "users", uid),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as StaffMember) : null),
    (error) => onError(error as Error)
  );
}

export async function getTenantPlanInfo(
  tenantId: string
): Promise<{ planId: PlanId; isTrial: boolean }> {
  const snap = await getDoc(doc(db, "tenants", tenantId));
  const data = snap.data();
  return {
    planId: (data?.planId as PlanId) ?? "basic",
    isTrial: (data?.isTrial as boolean) ?? false,
  };
}

// ─── Write: Free Edition API routes (Admin SDK, server-side) ──────────────
// All staff writes (Auth user creation, custom claims, staff-limit
// enforcement) happen server-side. Clients never write users/{userId}
// documents directly — see app/api/staff/{create,update,set-status}/route.ts.
//
// Free Edition note: these used to be Firebase Cloud Function callables
// (httpsCallable, see functions/src/userFunctions.ts) — Firebase Spark
// plan cannot deploy Cloud Functions, so they're now plain Next.js API
// routes called with fetch() + an Authorization: Bearer <idToken> header,
// same pattern as components/super-admin/CreateTenantModal.tsx already
// used for app/api/super-admin/create-tenant.
//
// `staffApiRequest()` deliberately throws an Error whose `.code` matches
// the same string values the old FirebaseError.code carried
// ("resource-exhausted", "already-exists", etc.) so
// components/tenant/users/staff-form-modal.tsx and
// toggle-staff-active-dialog.tsx — which already do
// `(err as { code?: string })?.code.includes("resource-exhausted")` —
// keep working completely unchanged.

interface StaffApiErrorBody {
  code?: string;
  message?: string;
}

class StaffFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "StaffFetchError";
  }
}

async function staffApiRequest<TResult>(path: string, payload: unknown): Promise<TResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new StaffFetchError("unauthenticated", "লগইন প্রয়োজন");
  const token = await getIdToken(currentUser, true);

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as StaffApiErrorBody;
    throw new StaffFetchError(body.code ?? "internal", body.message ?? "unknown");
  }

  return (await res.json()) as TResult;
}

export async function createStaffMember(
  payload: CreateStaffPayload
): Promise<CreateStaffResult> {
  return staffApiRequest<CreateStaffResult>("/api/staff/create", payload);
}

export async function updateStaffMember(payload: UpdateStaffPayload): Promise<void> {
  await staffApiRequest<{ success: true }>("/api/staff/update", payload);
}

export async function setStaffActiveStatus(
  payload: SetStaffActivePayload
): Promise<void> {
  await staffApiRequest<{ success: true }>("/api/staff/set-status", payload);
}
