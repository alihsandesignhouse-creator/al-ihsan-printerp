"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Users } from "lucide-react";
import { formatTaka } from "@/lib/utils/calculations";
import { DeleteCustomerDialog } from "./delete-customer-dialog";
import { EMPTY_CUSTOMER_FINANCIALS } from "@/lib/types/customer";
import type { Customer, CustomerFinancialSummary } from "@/lib/types/customer";

interface CustomerListTableProps {
  tenantId: string;
  userId: string;
  customers: Customer[];
  financialsByCustomerId: Map<string, CustomerFinancialSummary>;
  isLoading: boolean;
  canManage: boolean;
  onEdit: (customer: Customer) => void;
  onDeleted?: () => void;
}

export function CustomerListTable({
  tenantId,
  userId,
  customers,
  financialsByCustomerId,
  isLoading,
  canManage,
  onEdit,
  onDeleted,
}: CustomerListTableProps) {
  const t = useTranslations();
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <Users className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("customers.noCustomersFound")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">{t("customers.name")}</th>
                <th className="px-4 py-2.5">{t("customers.phone")}</th>
                <th className="px-4 py-2.5">{t("customers.companyName")}</th>
                <th className="px-4 py-2.5 text-right">{t("customers.totalBilled")}</th>
                <th className="px-4 py-2.5 text-right">{t("customers.totalDue")}</th>
                {canManage && <th className="px-4 py-2.5 text-right">{t("customers.actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {customers.map((customer) => {
                const financials = financialsByCustomerId.get(customer.id) ?? EMPTY_CUSTOMER_FINANCIALS;
                const hasDue = financials.totalDue > 0;
                return (
                  <tr key={customer.id} className={hasDue ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-neutral-50"}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="font-medium text-neutral-900 hover:text-brand-primary hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-600">{customer.phone}</td>
                    <td className="px-4 py-3 text-neutral-600">{customer.companyName || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-900">
                      {formatTaka(financials.totalBilled)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {hasDue ? (
                        <span className="font-semibold text-status-danger">{formatTaka(financials.totalDue)}</span>
                      ) : (
                        <span className="text-neutral-400">{formatTaka(0)}</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title={t("common.edit")}
                            onClick={() => onEdit(customer)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title={t("common.delete")}
                            onClick={() => setDeleteTarget(customer)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-status-danger hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteCustomerDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        tenantId={tenantId}
        userId={userId}
        customer={deleteTarget}
        onDeleted={onDeleted}
      />
    </>
  );
}
