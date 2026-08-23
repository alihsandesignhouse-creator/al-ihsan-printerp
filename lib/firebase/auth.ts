import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type User,
} from "firebase/auth";
import { auth } from "./client";
import { clearSessionCookie } from "./session";
import { logAuthEvent } from "./audit";
import type {
  AuthClaims,
  AuthUser,
  TenantSelfSignupPayload,
  TenantSelfSignupResult,
  UserRole,
} from "@/lib/types/auth";

const VALID_ROLES: UserRole[] = [
  "super_admin",
  "tenant_admin",
  "branch_manager",
  "commission_staff",
  "regular_staff",
];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_ROLES.includes(value as UserRole);
}

/**
 * Parses Firebase Auth custom claims into a typed structure.
 * Defensive: if claims are missing/malformed, defaults to a fully locked-down state.
 */
export function parseAuthClaims(rawClaims: Record<string, unknown>): AuthClaims {
  const role = isUserRole(rawClaims.role) ? rawClaims.role : "regular_staff";
  const tenantId = typeof rawClaims.tenantId === "string" ? rawClaims.tenantId : null;
  const isActive = typeof rawClaims.isActive === "boolean" ? rawClaims.isActive : false;
  const isTrial = typeof rawClaims.isTrial === "boolean" ? rawClaims.isTrial : false;
  const branchId = typeof rawClaims.branchId === "string" ? rawClaims.branchId : null;

  return { tenantId, role, isActive, isTrial, branchId };
}

/**
 * বাগ-ফিক্স (২১ আগস্ট ২০২৬, অফলাইন-আচরণ অডিট): আগে এখানে সবসময়
 * `getIdTokenResult(true)` (force-refresh) কল হতো, যা প্রতিটা
 * `onAuthStateChanged` ফায়ারে (অর্থাৎ প্রতিটা পেজ-লোড/রিলোডে) চলে।
 * ব্লুপ্রিন্টের অফলাইন-ফার্স্ট আর্কিটেকচার (section ৫) অনুযায়ী Firestore
 * persistentLocalCache অফলাইনে ডেটা দেখাতে প্রস্তুত, কিন্তু force-refresh
 * নেটওয়ার্ক ছাড়া সবসময় ব্যর্থ হয় (`auth/network-request-failed`) — এই
 * এরর use-auth-listener.ts-এর catch-এ ধরা পড়ে `setUser(null)` করত, যার
 * ফলে TenantLayout/SuperAdminLayout-এর "if (!user) router.replace('/login')"
 * ট্রিগার হতো। ফলাফল: মোবাইলে PWA অফলাইনে খুললে বা রিলোড করলে — এমনকি
 * আগে থেকে সঠিকভাবে লগইন করা থাকলেও — ইউজারকে সরাসরি লগইন পেজে পাঠিয়ে
 * দিত, অফলাইন-ক্যাশড কোনো ডেটাই দেখাতে পারত না। Firestore-এর অফলাইন
 * ক্যাপাবিলিটি ঠিকই ছিল, কিন্তু auth স্তরের এই force-refresh সেটা
 * কার্যকরভাবে ব্লক করে দিত।
 *
 * ফিক্স: force-refresh নেটওয়ার্ক-এরর দিয়ে ব্যর্থ হলে (অন্য কোনো এরর না)
 * cached (non-force) টোকেনে fallback করে — যেটা নেটওয়ার্ক ছাড়াই resolve
 * হয় যদি আগের টোকেন এখনো মেয়াদ-উত্তীর্ণ না হয়ে থাকে (Firebase Auth
 * টোকেনের মেয়াদ ১ ঘণ্টা)। অন্য যেকোনো এরর (যেমন টোকেন সত্যিই revoke
 * হয়েছে) আগের মতোই re-throw হয় — তখন লগ-আউট হওয়াটাই সঠিক আচরণ।
 */
export async function getAuthUserFromFirebaseUser(
  user: User
): Promise<AuthUser> {
  let tokenResult;
  try {
    tokenResult = await user.getIdTokenResult(true);
  } catch (err) {
    if (isNetworkError(err)) {
      tokenResult = await user.getIdTokenResult(false);
    } else {
      throw err;
    }
  }
  const claims = parseAuthClaims(tokenResult.claims as Record<string, unknown>);

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    claims,
  };
}

function isNetworkError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "auth/network-request-failed"
  );
}

/**
 * "মনে রাখুন" চেকবক্স (১৩ আগস্ট ২০২৬) — remember=true হলে Firebase Auth-এর
 * browserLocalPersistence (ডিফল্ট, ব্রাউজার বন্ধ করলেও সেশন থাকে) ব্যবহৃত
 * হয়; remember=false হলে browserSessionPersistence (ট্যাব/ব্রাউজার বন্ধ
 * করলেই লগআউট)। setPersistence() অবশ্যই signIn-এর ঠিক আগে কল করতে হয় —
 * Firebase-এর নিয়ম, পরে কল করলে পরবর্তী সেশনে প্রযোজ্য হয়, এই সেশনে না।
 */
export async function loginWithEmailPassword(
  email: string,
  password: string,
  remember: boolean = true
): Promise<AuthUser> {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return getAuthUserFromFirebaseUser(credential.user);
}

/**
 * Sends a Firebase Auth password-reset email. Deliberately swallows
 * `auth/user-not-found` so the caller always sees the same outcome whether
 * or not the email is registered — the same anti-enumeration pattern used
 * by `/api/portal/track` (identical "not found" response either way).
 * Other errors (invalid-email, too-many-requests, network) still throw so
 * the UI can show a real error.
 */
export async function sendResetPasswordEmail(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code.includes("user-not-found")) return;
    throw err;
  }
}

export async function signOut(currentUser?: AuthUser | null): Promise<void> {
  if (currentUser) {
    await logAuthEvent(currentUser, "auth.logout");
  }
  await firebaseSignOut(auth);
  clearSessionCookie();
}

/**
 * Calls the onTenantSelfSignup Cloud Function (via the /api/auth/signup
 * proxy route — see that route's docstring for why this isn't httpsCallable).
 * The function handles: Firebase Auth user creation, Firestore tenant document,
 * custom claim assignment, and Super Admin notification.
 * Client never writes tenant documents or sets claims directly.
 */
export async function signupTenant(
  payload: TenantSelfSignupPayload
): Promise<TenantSelfSignupResult> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as
    | TenantSelfSignupResult
    | { message?: string; code?: string };

  if (!res.ok) {
    const errData = data as { message?: string; code?: string };
    throw new Error(errData.code ?? errData.message ?? "unknown");
  }

  return data as TenantSelfSignupResult;
}

/** After signup the client must sign in to obtain a session with custom claims. */
export async function signupAndLogin(
  payload: TenantSelfSignupPayload
): Promise<AuthUser> {
  await signupTenant(payload);
  return loginWithEmailPassword(payload.email, payload.password);
}
