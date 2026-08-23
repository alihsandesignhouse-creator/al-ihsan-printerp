import {
  updateProfile as updateAuthProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "./client";
import type { AuthUser } from "@/lib/types/auth";
import type { AuditLog } from "@/lib/types/tenant";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

interface CloudinaryUploadResponse {
  secure_url: string;
}

function isCloudinaryUploadResponse(
  value: unknown
): value is CloudinaryUploadResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "secure_url" in value &&
    typeof (value as { secure_url: unknown }).secure_url === "string" &&
    (value as { secure_url: string }).secure_url.length > 0
  );
}

/**
 * Uploads a profile avatar to Cloudinary (same unsigned-preset pattern as
 * uploadTenantLogo in tenant-settings.ts), then writes the resulting URL
 * to Firebase Auth (photoURL) and mirrors it into the user's Firestore doc:
 * - tenant_admin → /tenants/{tenantId} `ownerAvatarUrl` field
 * - other roles  → /tenants/{tenantId}/users/{uid} `avatarUrl` field
 *
 * Requires NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
 * NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET env vars (same as logo upload).
 *
 * Returns the Cloudinary secure_url so the caller can update local state
 * without waiting for onAuthStateChanged to re-fire.
 */
export async function uploadProfileAvatar(
  firebaseUser: User,
  authUser: AuthUser,
  file: File
): Promise<string> {
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("size-exceeded");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("invalid-type");
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("cloudinary-config-missing");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `users/${authUser.uid}/avatar`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    throw new Error(`cloudinary-upload-failed-${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isCloudinaryUploadResponse(data)) {
    throw new Error("cloudinary-unexpected-response");
  }

  const url = data.secure_url;

  // 1. Update Firebase Auth photoURL
  await updateAuthProfile(firebaseUser, { photoURL: url });

  // 2. Mirror into Firestore
  const tenantId = authUser.claims.tenantId;
  if (tenantId) {
    const now = Timestamp.now();
    if (authUser.claims.role === "tenant_admin") {
      await updateDoc(doc(db, "tenants", tenantId), {
        ownerAvatarUrl: url,
        updatedAt: now,
      });
    } else {
      await updateDoc(
        doc(db, "tenants", tenantId, "users", authUser.uid),
        { avatarUrl: url, updatedAt: now }
      );
    }
  }

  return url;
}

/**
 * Changes the signed-in user's display name. Updates Firebase Auth
 * (source of truth for the session) and mirrors the name into Firestore:
 * - tenant_admin: the tenant document's `ownerName` field (they have no
 *   separate /users/{uid} doc — see lib/types/tenant.ts Tenant.ownerName).
 * - branch_manager / commission_staff / regular_staff: their own
 *   /tenants/{tenantId}/users/{uid} doc, `name` field only. firestore.rules
 *   allows self-service updates limited to exactly that one field.
 */
export async function updateDisplayName(
  firebaseUser: User,
  authUser: AuthUser,
  newName: string
): Promise<void> {
  const trimmed = newName.trim();
  await updateAuthProfile(firebaseUser, { displayName: trimmed });

  const tenantId = authUser.claims.tenantId;
  if (!tenantId) return; // super_admin: nothing to mirror

  const now = Timestamp.now();
  if (authUser.claims.role === "tenant_admin") {
    await updateDoc(doc(db, "tenants", tenantId), {
      ownerName: trimmed,
      updatedAt: now,
    });
  } else {
    await updateDoc(doc(db, "tenants", tenantId, "users", authUser.uid), {
      name: trimmed,
      updatedAt: now,
    });
  }
}

/**
 * Changes the signed-in user's password. Firebase Auth requires a recent
 * login for this operation, so we reauthenticate with the current password
 * first — this also serves as the "পুরনো পাসওয়ার্ড যাচাই" (old password
 * verification) requirement from blueprint module T-08.
 */
export async function changeOwnPassword(
  firebaseUser: User,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const email = firebaseUser.email;
  if (!email) throw new Error("no-email");

  const credential = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(firebaseUser, credential);
  await updatePassword(firebaseUser, newPassword);
}

/**
 * Fetches the signed-in user's own login/logout history (device & IP),
 * per blueprint section 11.6. Only the user's own auth.* audit_log entries
 * — firestore.rules restricts audit_logs reads to tenant_admin for the
 * full log, but any active user may read/write their own entries since
 * `request.auth.uid == userId` isn't required by the audit_logs read rule;
 * we scope the query client-side to this user's uid for the profile view.
 */
export async function fetchOwnLoginHistory(
  tenantId: string,
  uid: string,
  maxEntries = 20
): Promise<AuditLog[]> {
  const q = query(
    collection(db, "tenants", tenantId, "audit_logs"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(maxEntries)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as AuditLog)
    .filter((log) => log.action === "auth.login" || log.action === "auth.logout");
}
