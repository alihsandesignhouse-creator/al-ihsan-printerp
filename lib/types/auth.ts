export type UserRole =
  | "super_admin"
  | "tenant_admin"
  | "branch_manager"
  | "commission_staff"
  | "regular_staff";

/** Decoded Firebase Auth custom claims — never trust any tenantId from elsewhere */
export interface AuthClaims {
  tenantId: string | null;
  role: UserRole;
  isActive: boolean;
  isTrial: boolean;
  branchId?: string | null;
}

/** Current signed-in user, derived from Firebase Auth + custom claims */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** Firebase Auth photoURL — updated by uploadProfileAvatar() */
  photoURL: string | null;
  claims: AuthClaims;
}

/** Payload sent to the onTenantSelfSignup Cloud Function */
export interface TenantSelfSignupPayload {
  pressName: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  district?: string;
}

export interface TenantSelfSignupResult {
  tenantId: string;
  uid: string;
}
