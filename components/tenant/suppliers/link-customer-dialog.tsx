"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeCustomers } from "@/lib/firebase/customers";
import { linkCustomerToSupplier } from "@/lib/firebase/customer-supplier-link";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import type { Customer } from "@/lib/types/order";

interface LinkCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  supplier: { id: string; name: string };
}

/** সাপ্লায়ার প্রোফাইলে "কাস্টমারের সাথে লিংক করুন" — link-supplier-dialog.tsx-এর প্রতিসম সংস্করণ (১৭ আগস্ট ২০২৬)। */
export function LinkCustomerDialog({ open, onOpenChange, tenantId, supplier }: LinkCustomerDialogProps) {
  const t = useTranslations();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    const unsub = subscribeCustomers(tenantId, setCustomers, handleFirestoreError());
    return () => unsub();
  }, [open, tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setSelected(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const unlinked = customers.filter((c) => !c.linkedSupplierId);
    if (!q) return unlinked;
    return unlinked.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, term]);

  async function handleConfirm() {
    if (!selected) return;
    setIsLinking(true);
    try {
      await linkCustomerToSupplier(tenantId, { id: selected.id, name: selected.name }, supplier);
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
          <DialogTitle>{t("customerSupplierLink.linkToCustomerTitle")}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("customerSupplierLink.searchCustomerPlaceholder")}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200">
          {filtered.length === 0 && (
            <p className="p-3 text-sm text-neutral-400">{t("customerSupplierLink.noCustomerFound")}</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                selected?.id === c.id ? "bg-brand-primary/5" : ""
              }`}
            >
              <span className="font-medium text-neutral-900">{c.name}</span>
              <span className="text-xs text-neutral-500">{c.phone}</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-neutral-400">
          {t("customerSupplierLink.customerNotFoundHint")}{" "}
          <Link href="/dashboard/customers" className="text-brand-primary hover:underline">
            {t("customers.pageTitle")}
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
