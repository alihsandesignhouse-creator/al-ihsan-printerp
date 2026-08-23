"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X, Check, UserSearch, PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchCustomers } from "@/lib/firebase/customers";
import type { Customer } from "@/lib/types/order";

interface QuotationRecipientPickerProps {
  tenantId: string;
  selectedCustomer: Customer | null;
  recipientName: string;
  recipientPhone: string;
  recipientCompany: string;
  onSelectExisting: (customer: Customer) => void;
  onManualChange: (patch: { recipientName?: string; recipientPhone?: string; recipientCompany?: string }) => void;
  onClear: () => void;
  error?: string;
}

/**
 * কোটেশন orders থেকে আলাদা — একজন বিদ্যমান কাস্টমার প্রয়োজন হয় না
 * (blueprint T-14-এ কোনো customer field নেই), যেহেতু বাস্তবে quotation প্রায়ই
 * গ্রাহক হওয়ার আগেই পাঠানো হয়। তাই এখানে দুইটা মোড: বিদ্যমান কাস্টমার খুঁজে
 * বেছে নেওয়া (orders.customer-picker-এর মতোই searchCustomers ব্যবহার করে),
 * অথবা ম্যানুয়ালি নাম/ফোন/প্রতিষ্ঠান টাইপ করা — কোনো নতুন কাস্টমার ডকুমেন্ট
 * তৈরি না করেই। Order-এ রূপান্তরের সময় (Accepted → এক ক্লিকে অর্ডার) স্টাফকে
 * তখন CustomerPicker দিয়ে বাধ্যতামূলকভাবে একজন কাস্টমার বেছে নিতে/তৈরি করতে হয়।
 */
export function QuotationRecipientPicker({
  tenantId,
  selectedCustomer,
  recipientName,
  recipientPhone,
  recipientCompany,
  onSelectExisting,
  onManualChange,
  onClear,
  error,
}: QuotationRecipientPickerProps) {
  const t = useTranslations();
  const [mode, setMode] = useState<"search" | "manual">(selectedCustomer ? "search" : "manual");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (mode !== "search" || selectedCustomer) return;
    const handle = setTimeout(async () => {
      if (term.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        setResults(await searchCustomers(tenantId, term));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [term, tenantId, mode, selectedCustomer]);

  if (selectedCustomer) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-3">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-neutral-900">{selectedCustomer.name}</p>
            <p className="text-xs text-neutral-500">{selectedCustomer.phone}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white hover:text-neutral-600"
          aria-label={t("common.clear")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium ${
            mode === "search" ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-neutral-200 text-neutral-500"
          }`}
        >
          <UserSearch className="h-4 w-4" aria-hidden="true" />
          {t("quotations.searchExistingCustomer")}
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium ${
            mode === "manual" ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-neutral-200 text-neutral-500"
          }`}
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
          {t("quotations.enterManually")}
        </button>
      </div>

      {mode === "search" ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("quotations.searchCustomerPlaceholder")}
            className="pl-9"
          />
          {searching && <p className="mt-1 text-xs text-neutral-400">{t("common.searching")}</p>}
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectExisting(c);
                      setTerm("");
                      setResults([]);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    <span className="font-medium text-neutral-800">{c.name}</span>
                    <span className="text-xs text-neutral-400">{c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="recipientName">{t("quotations.recipientName")}</Label>
            <Input
              id="recipientName"
              value={recipientName}
              onChange={(e) => onManualChange({ recipientName: e.target.value })}
              placeholder={t("quotations.recipientNamePlaceholder")}
            />
          </div>
          <div>
            <Label htmlFor="recipientPhone">{t("quotations.recipientPhone")}</Label>
            <Input
              id="recipientPhone"
              value={recipientPhone}
              onChange={(e) => onManualChange({ recipientPhone: e.target.value })}
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <Label htmlFor="recipientCompany">{t("quotations.recipientCompany")}</Label>
            <Input
              id="recipientCompany"
              value={recipientCompany}
              onChange={(e) => onManualChange({ recipientCompany: e.target.value })}
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  );
}
