"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Link2, Unlink } from "lucide-react";
import { ConfirmDialog } from "@/components/super-admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { formatTaka } from "@/lib/utils/calculations";

interface LinkedProfileBannerProps {
  /** যে প্রোফাইল থেকে দেখা হচ্ছে তার দিক থেকে অপর প্রোফাইলের ধরন। */
  otherRole: "customer" | "supplier";
  otherProfileHref: string;
  otherProfileName: string;
  /** এই কাস্টমার আমাদের কাছে কত বকেয়া দেয় (customer.totalDue) */
  customerDue: number;
  /** আমরা এই সাপ্লায়ারকে কত বকেয়া দিই (supplier.currentDue) */
  supplierDue: number;
  canManage: boolean;
  onUnlink: () => Promise<void>;
}

/**
 * "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচারের banner (১৭ আগস্ট ২০২৬) —
 * customer detail ও supplier detail উভয় পেজেই ব্যবহৃত হয় (শুধু `otherRole`
 * বদলায়)। ইচ্ছাকৃতভাবে দুই দিকের লেজার merge করে একটা "combined
 * transaction" টেবিল বানানো হয়নি — অর্ডার + পেমেন্ট + সাপ্লায়ার লেজার
 * তিনটার টাইমিং/সাইন কনভেনশন আলাদা, ভুলভাবে merge করলে ভুল হিসাব দেখানোর
 * ঝুঁকি থাকে। এর বদলে দুই দিকের সরকারি বকেয়া সংখ্যা পাশাপাশি + একটা
 * নিট অবস্থান দেখানো হয়, বিস্তারিত জানতে অন্য প্রোফাইলে ক্লিক করা যায়।
 */
export function LinkedProfileBanner({
  otherRole,
  otherProfileHref,
  otherProfileName,
  customerDue,
  supplierDue,
  canManage,
  onUnlink,
}: LinkedProfileBannerProps) {
  const t = useTranslations();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const net = customerDue - supplierDue;

  async function handleConfirmUnlink() {
    setIsUnlinking(true);
    try {
      await onUnlink();
    } finally {
      setIsUnlinking(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-purple-900">
              {t(
                otherRole === "supplier"
                  ? "customerSupplierLink.alsoSupplier"
                  : "customerSupplierLink.alsoCustomer"
              )}
            </p>
            <Link href={otherProfileHref} className="mt-0.5 inline-flex items-center gap-1 text-sm text-purple-700 hover:underline">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              {otherProfileName}
            </Link>
          </div>
        </div>

        {canManage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-purple-700 hover:bg-purple-100"
            onClick={() => setConfirmOpen(true)}
          >
            <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
            {t("customerSupplierLink.unlink")}
          </Button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-white/60 p-2.5">
          <p className="text-xs text-neutral-500">{t("customerSupplierLink.customerDue")}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-900">{formatTaka(customerDue)}</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2.5">
          <p className="text-xs text-neutral-500">{t("customerSupplierLink.supplierDue")}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-900">{formatTaka(supplierDue)}</p>
        </div>
        <div className="rounded-lg bg-white p-2.5">
          <p className="text-xs text-neutral-500">{t("customerSupplierLink.netPosition")}</p>
          <p className={`mt-0.5 font-mono text-sm font-semibold ${net >= 0 ? "text-status-success" : "text-status-danger"}`}>
            {net >= 0
              ? t("customerSupplierLink.netTheyOweYou", { amount: formatTaka(net) })
              : t("customerSupplierLink.netYouOweThem", { amount: formatTaka(Math.abs(net)) })}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("customerSupplierLink.unlinkConfirmTitle")}
        description={t("customerSupplierLink.unlinkConfirmDesc")}
        confirmLabel={t("customerSupplierLink.unlink")}
        onConfirm={handleConfirmUnlink}
        loading={isUnlinking}
      />
    </div>
  );
}
