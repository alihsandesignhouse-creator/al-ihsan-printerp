"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, UserPlus, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchCustomers } from "@/lib/firebase/customers";
import type { Customer, CustomerFormData } from "@/lib/types/order";

interface CustomerPickerProps {
  tenantId: string;
  selectedCustomer: Customer | null;
  newCustomer: CustomerFormData | null;
  onSelectExisting: (customer: Customer) => void;
  onCreateNew: (data: CustomerFormData) => void;
  onClear: () => void;
  error?: string;
}

const EMPTY_FORM: CustomerFormData = {
  name: "",
  phone: "",
  email: "",
  address: "",
  companyName: "",
};

export function CustomerPicker({
  tenantId,
  selectedCustomer,
  newCustomer,
  onSelectExisting,
  onCreateNew,
  onClear,
  error,
}: CustomerPickerProps) {
  const t = useTranslations();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CustomerFormData>(EMPTY_FORM);

  useEffect(() => {
    if (selectedCustomer || newCustomer) return;
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const found = await searchCustomers(tenantId, term);
        if (!cancelled) setResults(found);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [term, tenantId, selectedCustomer, newCustomer]);

  if (selectedCustomer) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-neutral-900">{selectedCustomer.name}</p>
              <p className="text-xs text-neutral-500">{selectedCustomer.phone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-neutral-400 hover:text-neutral-600"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  if (newCustomer) {
    return (
      <div className="rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-neutral-900">{newCustomer.name}</p>
              <p className="text-xs text-neutral-500">
                {newCustomer.phone} &middot; {t("orders.newCustomerLabel")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-neutral-400 hover:text-neutral-600"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="newCustomerName">{t("orders.customerName")} *</Label>
            <Input
              id="newCustomerName"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="newCustomerPhone">{t("orders.customerPhone")} *</Label>
            <Input
              id="newCustomerPhone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <Label htmlFor="newCustomerCompany">{t("orders.customerCompany")}</Label>
            <Input
              id="newCustomerCompany"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="newCustomerAddress">{t("orders.customerAddress")}</Label>
            <Input
              id="newCustomerAddress"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="h-9 rounded-lg px-3 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={form.name.trim().length < 2 || !/^01[3-9]\d{8}$/.test(form.phone.trim())}
            onClick={() => {
              onCreateNew(form);
              setForm(EMPTY_FORM);
              setShowCreateForm(false);
            }}
            className="h-9 rounded-lg bg-brand-primary px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("orders.addCustomer")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("orders.customerSearchPlaceholder")}
          className="pl-9"
        />
      </div>
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}

      {isSearching && <p className="mt-2 text-xs text-neutral-400">{t("common.loading")}</p>}

      {!isSearching && results.length > 0 && (
        <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelectExisting(c);
                setTerm("");
                setResults([]);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              <span className="font-medium text-neutral-900">{c.name}</span>
              <span className="text-xs text-neutral-500">{c.phone}</span>
            </button>
          ))}
        </div>
      )}

      {!isSearching && term.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 text-xs text-neutral-400">{t("orders.noCustomerFound")}</p>
      )}

      <button
        type="button"
        onClick={() => {
          setShowCreateForm(true);
          setForm((f) => ({ ...f, phone: /^\d+$/.test(term) ? term : f.phone, name: /^\d+$/.test(term) ? f.name : term }));
        }}
        className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {t("orders.addNewCustomerInline")}
      </button>
    </div>
  );
}
