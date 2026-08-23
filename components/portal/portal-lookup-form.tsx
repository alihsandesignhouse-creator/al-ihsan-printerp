"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { portalTrackingSchema, type PortalTrackingFormValues } from "@/lib/validations/portal";
import type { PortalTrackingResult } from "@/lib/types/portal";

interface PortalLookupFormProps {
  tenantId: string;
  onResult: (result: PortalTrackingResult) => void;
}

/**
 * Module T-20 — blueprint: "অর্ডার নম্বর দিয়ে ট্র্যাকিং (লগইন ছাড়াও)"।
 * কল করে POST /api/portal/track, যা getPortalOrderStatus Cloud Function-এ
 * প্রক্সি করে (Admin SDK, Firestore rules বাইপাস — এই একমাত্র পাবলিক পথ)।
 */
export function PortalLookupForm({ tenantId, onResult }: PortalLookupFormProps) {
  const t = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // চালানে থাকা QR কোড (components/shared/tracking-qr-code.tsx) স্ক্যান
  // করলে `?order=...` কোয়েরি-প্যারামে আসে — শুধু অর্ডার নম্বর প্রি-ফিল হয়,
  // ফোন নম্বর এখনো ভেরিফিকেশনের জন্য টাইপ করতে হয় (কোনো প্রাইভেট ডেটা
  // URL/QR-এ থাকে না)।
  const searchParams = useSearchParams();
  const prefillOrderNumber = searchParams.get("order") ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PortalTrackingFormValues>({
    resolver: zodResolver(portalTrackingSchema),
    defaultValues: { orderNumber: prefillOrderNumber, phone: "" },
  });

  async function onSubmit(values: PortalTrackingFormValues) {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/portal/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...values }),
      });
      const data = (await res.json()) as PortalTrackingResult & { message?: string };
      if (!res.ok) {
        setServerError(data.message || t("portal.lookupFailed"));
        return;
      }
      onResult(data);
    } catch {
      setServerError(t("portal.networkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="orderNumber">{t("portal.orderNumberLabel")}</Label>
        <Input
          id="orderNumber"
          placeholder={t("portal.orderNumberPlaceholder")}
          {...register("orderNumber")}
          className="font-mono"
        />
        {errors.orderNumber && <p className="mt-1 text-xs text-status-danger">{t(errors.orderNumber.message ?? "")}</p>}
      </div>

      <div>
        <Label htmlFor="phone">{t("portal.phoneLabel")}</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="01XXXXXXXXX"
          {...register("phone")}
        />
        {errors.phone && <p className="mt-1 text-xs text-status-danger">{t(errors.phone.message ?? "")}</p>}
        <p className="mt-1 text-xs text-neutral-400">{t("portal.phoneHint")}</p>
      </div>

      {serverError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-status-danger">{serverError}</p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
        {t("portal.trackButton")}
      </Button>
    </form>
  );
}
