"use client";

/**
 * "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচার, ধাপ ৬ (১৭ আগস্ট ২০২৬) —
 * "ক্রয় করুন" রুট। app/(tenant)/dashboard/orders/new/page.tsx-এর কাঠামো
 * অনুসরণ করে (পাতলা page কম্পোনেন্ট, আসল ফর্ম-লজিক components/tenant/
 * suppliers/purchase-form.tsx-এ)। শুধু এই সাপ্লায়ারের জন্যই — supplier
 * প্রোফাইল বা দ্বৈত (কাস্টমার+সাপ্লায়ার) প্রোফাইল পেজের "ক্রয় করুন" বাটন
 * থেকে নেভিগেট করে আসা হয়।
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeSupplier } from "@/lib/firebase/suppliers";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { PurchaseForm } from "@/components/tenant/suppliers/purchase-form";
import type { Supplier } from "@/lib/types/supplier";

export default function SupplierPurchasePage() {
  const t = useTranslations();
  const params = useParams<{ supplierId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const handleFirestoreError = useFirestoreErrorHandler();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !params.supplierId) return;
    setIsLoading(true);
    const unsub = subscribeSupplier(
      tenantId,
      params.supplierId,
      (data) => {
        setSupplier(data);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, params.supplierId, handleFirestoreError]);

  if (!tenantId) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.push(`/dashboard/suppliers/${params.supplierId}`)}
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("common.back")}
      </button>

      <h1 className="text-lg font-semibold text-neutral-900">{t("suppliers.recordPurchaseAction")}</h1>

      {isLoading || !supplier ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      ) : (
        <PurchaseForm
          tenantId={tenantId}
          supplier={supplier}
          onSuccess={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
          onCancel={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
        />
      )}
    </div>
  );
}
