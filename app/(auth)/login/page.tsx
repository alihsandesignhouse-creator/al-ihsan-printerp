"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, AlertCircle, Loader2, Mail, Lock, Phone, MessageCircle } from "lucide-react";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";
import { loginWithEmailPassword } from "@/lib/firebase/auth";
import { writeSessionCookie } from "@/lib/firebase/session";
import { logAuthEvent } from "@/lib/firebase/audit";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getPlatformSettingsOnce } from "@/lib/firebase/platform-settings";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/lib/types/platform-settings";
import { AuthSplitLayout } from "@/components/shared/auth-split-layout";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [contact, setContact] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

  // Module SA-05: contact info (phone/whatsapp/email) ও logo এখন
  // Super-Admin-managed (/platform_settings/general), হার্ডকোডেড
  // কনস্ট্যান্ট না — public read, auth লাগে না (দেখুন firestore.rules
  // "Platform settings" ব্লক)।
  useEffect(() => {
    getPlatformSettingsOnce()
      .then(setContact)
      .catch(() => {
        /* keep the default already shown */
      });
  }, []);

  const setUser = useAuthStore((s) => s.setUser);
  const whatsappHref = `https://wa.me/${contact.whatsappPhone.replace(/^0/, "880")}`;

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const authUser = await loginWithEmailPassword(values.email, values.password, rememberMe);
      setUser(authUser);
      writeSessionCookie(authUser.claims, rememberMe);
      void logAuthEvent(authUser, "auth.login");

      if (authUser.claims.role === "super_admin") {
        router.push("/super-admin/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setServerError(t("auth.loginError"));
    }
  }

  return (
    <AuthSplitLayout logoUrl={contact.logoUrl}>
      <div className="mb-8">
        <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-bold tracking-tight text-neutral-900">
          {t("auth.loginTitle")}
          <span className="text-base font-normal text-neutral-400">·</span>
          <span className="text-sm font-normal text-neutral-500">{t("auth.loginSubtitle")}</span>
        </h1>
      </div>

      {serverError && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
            {t("auth.email")}
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              {...register("email")}
              className={`h-11 w-full rounded-lg border pl-10 pr-3.5 text-sm transition-all focus:scale-[1.01] focus:outline-none focus:ring-2 ${
                errors.email
                  ? "border-status-danger focus:ring-status-danger/30"
                  : "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/15"
              }`}
            />
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-status-danger">{t(errors.email.message ?? "")}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              {...register("password")}
              className={`h-11 w-full rounded-lg border pl-10 pr-10 text-sm transition-all focus:scale-[1.01] focus:outline-none focus:ring-2 ${
                errors.password
                  ? "border-status-danger focus:ring-status-danger/30"
                  : "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/15"
              }`}
            />
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-brand-primary"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-status-danger">{t(errors.password.message ?? "")}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/30"
          />
          <label htmlFor="rememberMe" className="cursor-pointer text-sm text-neutral-600">
            {t("auth.rememberMe")}
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary text-sm font-semibold text-white shadow-sm shadow-brand-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-primary/30 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("auth.loggingIn") : t("auth.login")}
        </button>
      </form>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <Lock className="h-3 w-3" aria-hidden="true" />
        {t("auth.secureLoginNote")}
      </p>

      <p className="mt-3 text-center text-sm">
        <Link href={"/forgot-password"} className="text-brand-primary hover:underline">
          {t("auth.forgotPassword")} {t("auth.resetPassword")}
        </Link>
      </p>

      <div className="my-6 flex items-center gap-2">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs text-neutral-400">{t("common.or")}</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <Link
        href={"/signup"}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-brand-primary text-sm font-semibold text-brand-primary transition-colors hover:bg-blue-50"
      >
        {t("auth.freeTrialBtn")}
      </Link>

      <div className="mt-4 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
        {/*
          "নির্মাতার পরিচিতি" dashboard-shell ফিক্স সেশনের দ্বিতীয় রিভিশন
          (১৪ আগস্ট ২০২৬): এই "Trial শেষ? যোগাযোগ" লাইনটা আগে প্লেইন টেক্সট
          ছিল (কোনো ক্লিকযোগ্য বাটন ছাড়া) — এখন WhatsApp/Call/Email তিনটা
          আইকন-বাটন যোগ করা হলো, ঠিক trial-expired ও suspended পেজে যে
          একই wa.me/tel/mailto প্যাটার্ন আছে তারই অনুসরণে।
        */}
        <p className="text-center text-xs font-medium text-neutral-500">
          {t("auth.trialContact")} {contact.supportPhone}
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("trial.whatsappContact")}
            title={t("trial.whatsappContact")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <a
            href={`tel:${contact.supportPhone}`}
            aria-label={t("trial.phoneContact")}
            title={t("trial.phoneContact")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-primary text-brand-primary hover:bg-blue-50"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <a
            href={`mailto:${contact.supportEmail}`}
            aria-label={t("trial.emailContact")}
            title={t("trial.emailContact")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-100"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-neutral-400">
        <Link href="/about" className="hover:text-brand-primary hover:underline">
          {t("auth.aboutUsLink")}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}

