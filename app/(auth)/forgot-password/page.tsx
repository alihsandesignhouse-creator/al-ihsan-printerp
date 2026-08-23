"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validations/auth";
import { sendResetPasswordEmail } from "@/lib/firebase/auth";
import { getPlatformSettingsOnce } from "@/lib/firebase/platform-settings";
import { AuthSplitLayout } from "@/components/shared/auth-split-layout";

/**
 * AUDIT-REPORT-3.md Issue #2 fix: the login page has always linked here
 * (and middleware.ts has always allowlisted this path), but the page
 * itself never existed — every "forgot password" click 404'd. Uses
 * Firebase Auth's built-in `sendPasswordResetEmail` (same mechanism as
 * `ChangePasswordForm`'s reauth flow uses Firebase Auth directly), and
 * always shows the same success message regardless of whether the email
 * is registered (see `sendResetPasswordEmail`'s docstring) — the same
 * anti-enumeration convention already established by `/api/portal/track`.
 *
 * প্রিমিয়াম auth-পেজ রিডিজাইন (৯ আগস্ট ২০২৬): login page-এর সাথে সামঞ্জস্য
 * রেখে AuthSplitLayout শেল — reset-লজিক অপরিবর্তিত।
 */
export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    getPlatformSettingsOnce()
      .then((s) => setLogoUrl(s.logoUrl))
      .catch(() => {
        /* keep the SVG fallback logo */
      });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setServerError(null);
    try {
      await sendResetPasswordEmail(values.email);
      setSent(true);
    } catch {
      setServerError(t("auth.resetLinkFailed"));
    }
  }

  return (
    <AuthSplitLayout logoUrl={logoUrl}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">{t("auth.forgotPasswordTitle")}</h1>
        <p className="mt-1.5 text-sm text-neutral-500">{t("auth.forgotPasswordSubtitle")}</p>
      </div>

      {sent ? (
        <div className="flex items-start gap-2 rounded-lg border border-status-success/30 bg-status-success/5 px-3 py-2.5 text-sm text-status-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("auth.resetLinkSent")}</span>
        </div>
      ) : (
        <>
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
              <input
                id="email"
                type="email"
                {...register("email")}
                className={`h-11 w-full rounded-lg border px-3.5 text-sm transition-shadow focus:outline-none focus:ring-2 ${
                  errors.email
                    ? "border-status-danger focus:ring-status-danger/30"
                    : "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/15"
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-status-danger">{t(errors.email.message ?? "")}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary text-sm font-semibold text-white shadow-sm shadow-brand-primary/25 transition-all hover:shadow-md hover:shadow-brand-primary/30 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
            </button>
          </form>
        </>
      )}

      <p className="mt-4 text-center text-sm">
        <Link href={"/login"} className="text-brand-primary hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
