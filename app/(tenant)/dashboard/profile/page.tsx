"use client";

import { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Camera, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { ChangeNameForm } from "@/components/tenant/profile/change-name-form";
import { ChangePasswordForm } from "@/components/tenant/profile/change-password-form";
import { LoginHistoryList } from "@/components/tenant/profile/login-history-list";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { uploadProfileAvatar } from "@/lib/firebase/profile";
import { auth } from "@/lib/firebase/client";

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale() as "bn" | "en";
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localPhotoURL, setLocalPhotoURL] = useState<string | null>(null);

  if (!user) return null;

  const roleLabelKey = `roles.${user.claims.role}`;
  // localPhotoURL takes precedence immediately after upload (before
  // onAuthStateChanged re-fires and refreshes the store).
  const displayPhoto = localPhotoURL ?? user.photoURL;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected if needed.
    e.target.value = "";
    if (!file) return;

    const firebaseUser = auth.currentUser;
    // user is guaranteed non-null here (early return above guards it),
    // but TypeScript needs the explicit check for the callback closure.
    if (!firebaseUser || !user) return;

    setIsUploading(true);
    try {
      const url = await uploadProfileAvatar(firebaseUser, user, file);
      setLocalPhotoURL(url);
      // Reflect immediately in the global auth store so TopNavbar also updates.
      // Spread with explicit required fields to satisfy strict AuthUser type.
      setUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: url,
        claims: user.claims,
      });
      toast.success(t("profile.avatar.saved"));
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message === "size-exceeded"
          ? t("profile.avatar.sizeError")
          : err instanceof Error && err.message === "invalid-type"
            ? t("profile.avatar.typeError")
            : t("profile.avatar.saveFailed");
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4 md:p-6">
      {/* Avatar + identity header */}
      <div className="flex items-center gap-4">
        {/* Clickable avatar circle */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title={t("profile.avatar.upload")}
            className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            {displayPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayPhoto}
                alt={user.displayName ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle className="h-9 w-9 text-brand-primary" aria-hidden="true" />
            )}

            {/* Hover/loading overlay */}
            <span
              className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/40 transition-opacity ${
                isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              aria-hidden="true"
            >
              {isUploading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleAvatarChange}
            aria-label={t("profile.avatar.upload")}
          />
        </div>

        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            {user.displayName || user.email}
          </h1>
          <p className="text-sm text-neutral-500">
            {t(roleLabelKey)} · {user.email}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mt-1 text-xs text-brand-primary hover:underline disabled:opacity-50"
          >
            {isUploading ? t("profile.avatar.uploading") : t("profile.avatar.upload")}
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("profile.name.title")}</h2>
        <ChangeNameForm authUser={user} onUpdated={() => undefined} />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("profile.password.title")}</h2>
        <ChangePasswordForm />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">{t("profile.language.title")}</h2>
        <p className="mb-4 text-xs text-neutral-500">{t("profile.language.note")}</p>
        <LanguageToggle currentLocale={locale} />
      </section>

      {user.claims.tenantId && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("profile.history.title")}</h2>
          <LoginHistoryList tenantId={user.claims.tenantId} uid={user.uid} />
        </section>
      )}
    </div>
  );
}
