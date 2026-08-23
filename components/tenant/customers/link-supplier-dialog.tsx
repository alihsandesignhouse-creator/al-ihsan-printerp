"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeSuppliers } from "@/lib/firebase/suppliers";
import { linkCustomerToSupplier } from "@/lib/firebase/customer-supplier-link";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import type { Supplier } from "@/lib/types/supplier";

interface LinkSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  branchId: string | "all";
  customer: { id: string; name: string };
}

/**
 * কাস্টমার প্রোফাইলে "সাপ্লায়ারের সাথে লিংক করুন" — বিদ্যমান সাপ্লায়ার
 * খুঁজে/বেছে দুই প্রোফাইল সংযুক্ত করে (১৭ আগস্ট ২০২৬)। নতুন সাপ্লায়ার
 * তৈরি এখানে হয় না — ইচ্ছাকৃতভাবে সরল রাখা হয়েছে, না থাকলে আগে
 * সাপ্লায়ার পেজ থেকে সাধারণভাবে তৈরি করে তারপর এখানে লিংক করতে হবে।
 */
export function LinkSupplierDialog({ open, onOpenChange, tenantId, branchId, customer }: LinkSupplierDialogProps) {
  const t = useTranslations();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    const unsub = subscribeSuppliers(tenantId, branchId, setSuppliers, handleFirestoreError());
    return () => unsub();
  }, [open, tenantId, branchId, handleFirestoreError]);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setSelected(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const unlinked = suppliers.filter((s) => !s.linkedCustomerId);
    if (!q) return unlinked;
    return unlinked.filter((s) => s.name.toLowerCase().includes(q) || s.phone.includes(q));
  }, [suppliers, term]);

  async function handleConfirm() {
    if (!selected) return;
    setIsLinking(true);
    try {
      await linkCustomerToSupplier(tenantId, customer, { id: selected.id, name: selected.name });
      toast.success(t("customerSupplierLink.linked"));
      onOpenChange(false);
    } catch {
      toast.error(t("customerSupplierLink.linkFailed"));
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("customerSupplierLink.linkToSupplierTitle")}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("customerSupplierLink.searchSupplierPlaceholder")}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200">
          {filtered.length === 0 && (
            <p className="p-3 text-sm text-neutral-400">{t("customerSupplierLink.noSupplierFound")}</p>
          )}
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                selected?.id === s.id ? "bg-brand-primary/5" : ""
              }`}
            >
              <span className="font-medium text-neutral-900">{s.name}</span>
              <span className="text-xs text-neutral-500">{s.phone}</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-neutral-400">
          {t("customerSupplierLink.supplierNotFoundHint")}{" "}
          <Link href="/dashboard/suppliers" className="text-brand-primary hover:underline">
            {t("suppliers.pageTitle")}
          </Link>
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLinking}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selected || isLinking}>
            {isLinking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("customerSupplierLink.confirmLink")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
