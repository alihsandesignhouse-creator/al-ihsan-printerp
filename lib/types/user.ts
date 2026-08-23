import type { Timestamp } from "firebase/firestore";
import type { PlanId } from "@/lib/types/tenant";

/**
 * Roles that a Tenant Admin can create/manage from the Module T-07 panel.
 * 'tenant_admin' is created only at signup/activation time and never appears
 * here — this matches blueprint section 3.2 (Tenant Admin creates Staff &
 * Branch Manager, not other Tenant Admins).
 */
export type StaffRole = "branch_manager" | "commission_staff" | "regular_staff";

export const STAFF_ROLES: StaffRole[] = [
  "branch_manager",
  "commission_staff",
  "regular_staff",
];

/**
 * Document shape at /tenants/{tenantId}/users/{userId}.
 * Field names (id, name, role, branchId, isActive) intentionally mirror
 * exactly what lib/firebase/orders.ts → getActiveStaffOptions() already
 * reads, so order assignment dropdowns keep working unchanged.
 */
export interface StaffMember {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  email: string;
  role: StaffRole;
  commissionRate: number; // percent, 0–100
  isActive: boolean;
  /**
   * নিজস্ব প্রোফাইল ছবি (সেশন ৫, ১৮ আগস্ট ২০২৬) — lib/firebase/profile.ts-এর
   * uploadProfileAvatar() লেখে (self-service, firestore.rules-এ users
   * update rule-এর hasOnly() allowlist-এ 'name'-এর পাশে যোগ করা হয়েছে)।
   * পুরনো ডকুমেন্টে এই ফিল্ড নেই বলে optional।
   */
  avatarUrl?: string;
  deletedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Plan-based staff limits (blueprint section 4.3) ───────────────────────
// Authoritative enforcement happens in functions/src/userFunctions.ts.
// This copy is for client-side display only (e.g. "৩ / ৩ ব্যবহৃত").
export const PLAN_STAFF_LIMITS: Record<PlanId, number> = {
  basic: 3,
  standard: 10,
  premium: Infinity,
};

// ─── Form data ──────────────────────────────────────────────────────────

export interface CreateStaffFormData {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  branchId: string; // "" = no branch assigned
  commissionRate: number;
}

export interface UpdateStaffFormData {
  userId: string;
  name: string;
  role: StaffRole;
  branchId: string; // "" = no branch assigned
  commissionRate: number;
  newPassword: string; // "" = no change
}

// ─── Cloud Function payload/result types ──────────────────────────────────

export interface CreateStaffPayload {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  branchId: string | null;
  commissionRate: number;
}

export interface CreateStaffResult {
  userId: string;
}

export interface UpdateStaffPayload {
  userId: string;
  name: string;
  role: StaffRole;
  branchId: string | null;
  commissionRate: number;
  newPassword?: string;
}

export interface SetStaffActivePayload {
  userId: string;
  isActive: boolean;
}
