"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { signupSchema, type SignupFormValues } from "@/lib/validations/auth";
import { signupAndLogin } from "@/lib/firebase/auth";
import { writeSessionCookie } from "@/lib/firebase/session";
import { logAuthEvent } from "@/lib/firebase/audit";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getPlatformSettingsOnce } from "@/lib/firebase/platform-settings";
import { AuthSplitLayout } from "@/components/shared/auth-split-layout";

function FirebaseErrorMessage(code: string): string {
  if (code.includes("email-already-in-use")) return "signup.emailAlreadyInUse";
  return "signup.errorTitle";
}

const inputClass = (hasError: boolean) =>
  `h-11 w-full rounded-lg border px-3.5 text-sm transition-shadow focus:outline-none focus:ring-2 ${
    hasError
      ? "border-status-danger focus:ring-status-danger/30"
      : "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/15"
  }`;

export default function SignupPage() {
  const t = useTranslations();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
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
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { district: "" },
  });

  async function onSubmit(values: SignupFormValues) {
    setServerError(null);
    try {
      const authUser = await signupAndLogin({
        pressName: values.pressName,
        ownerName: values.ownerName,
        email: values.email,
        password: values.password,
        phone: values.phone,
        district: values.district || undefined,
      });
      setUser(authUser);
      writeSessionCookie(authUser.claims);
      void logAuthEvent(authUser, "auth.login");
      setIsSuccess(true);
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err) {
      const code = err instanceof Error ? err.message : "unknown";
      setServerError(t(FirebaseErrorMessage(code)));
    }
  }

  if (isSuccess) {
    return (
      <AuthSplitLayout logoUrl={logoUrl}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-neutral-900">{t("signup.successTitle")}</h1>
          <p className="text-sm text-neutral-500">{t("signup.successMessage")}</p>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout logoUrl={logoUrl} wide>
      <div className="mb-8">
        <p className="text-sm font-semibold text-brand-primary">{t("signup.title")}</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">AL-IHSAN PrintERP</h1>
        <p className="mt-1.5 text-sm text-neutral-500">{t("signup.subtitle")}</p>
      </div>

      {serverError && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pressName" className="mb-1.5 block text-sm font-medium text-neutral-700">
              {t("signup.pressName")} *
            </label>
            <input
              id="pressName"
              type="text"
              placeholder={t("signup.pressNamePlaceholder")}
              {...register("pressName")}
              className={inputClass(!!errors.pressName)}
            />
            {errors.pressName && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.pressName.message ?? "")}</p>
            )}
          </div>

          <div>
            <label htmlFor="ownerName" className="mb-1.5 block text-sm font-medium text-neutral-700">
              {t("signup.ownerName")} *
            </label>
            <input
              id="ownerName"
              type="text"
              placeholder={t("signup.ownerNamePlaceholder")}
              {...register("ownerName")}
              className={inputClass(!!errors.ownerName)}
            />
            {errors.ownerName && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.ownerName.message ?? "")}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
            {t("signup.email")} *
          </label>
          <input
            id="email"
            type="email"
            placeholder={t("signup.emailPlaceholder")}
            {...register("email")}
            className={inputClass(!!errors.email)}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-status-danger">{t(errors.email.message ?? "")}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
              {t("signup.password")} *
            </label>
            <input
              id="password"
              type="password"
              placeholder={t("signup.passwordPlaceholder")}
              {...register("password")}
              className={inputClass(!!errors.password)}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.password.message ?? "")}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-neutral-700">
              {t("signup.phone")} *
            </label>
            <input
              id="phone"
              type="tel"
              placeholder={t("signup.phonePlaceholder")}
              {...register("phone")}
              className={inputClass(!!errors.phone)}
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-status-danger">{t(errors.phone.message ?? "")}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="district" className="mb-1.5 block text-sm font-medium text-neutral-700">
            {t("signup.district")}
          </label>
          <input
            id="district"
            type="text"
            placeholder={t("signup.districtPlaceholder")}
            {...register("district")}
            className={inputClass(false)}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary text-sm font-semibold text-white shadow-sm shadow-brand-primary/25 transition-all hover:shadow-md hover:shadow-brand-primary/30 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("signup.submitting") : t("signup.submitBtn")}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-neutral-500">
        {t("signup.alreadyHaveAccount")}{" "}
        <Link href={"/login"} className="font-medium text-brand-primary hover:underline">
          {t("signup.loginLink")}
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-neutral-400">
        <Link href="/about" className="hover:text-brand-primary hover:underline">
          {t("auth.aboutUsLink")}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
