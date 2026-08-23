"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, Printer, Trash2, ArrowRightCircle, Loader2, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  subscribeToQuotation,
  subscribeToQuotationItems,
  softDeleteQuotation,
} from "@/lib/firebase/quotations";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { QuotationStatusBadge } from "@/components/tenant/quotations/quotation-status-badge";
import { QuotationStatusControl } from "@/components/tenant/quotations/quotation-status-control";
import { QuotationPrintView } from "@/components/tenant/quotations/quotation-print-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatTaka } from "@/lib/utils/calculations";
import type { Quotation, QuotationItem } from "@/lib/types/quotation";
import type { Branch } from "@/lib/types/dashboard";

export default function QuotationDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ quotationId: string }>();
  const searchParams = useSearchParams();
  const quotationId = params.quotationId;

  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const canManage = role === "tenant_admin" || role === "branch_manager";
  const handleFirestoreError = useFirestoreErrorHandler();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [tenantInfo, setTenantInfo] = useState<{ name: string; logoUrl: string; address: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPrintView, setShowPrintView] = useState(searchParams.get("action") === "print");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !quotationId) return;
    const unsub = subscribeToQuotation(
      tenantId,
      quotationId,
      (data) => {
        setQuotation(data);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, quotationId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !quotationId) return;
    const unsub = subscribeToQuotationItems(tenantId, quotationId, setItems, handleFirestoreError());
    return () => unsub();
  }, [tenantId, quotationId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    getDoc(doc(db, "tenants", tenantId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTenantInfo({
          name: (data.name as string) ?? "",
          logoUrl: (data.logoUrl as string) ?? "",
          address: (data.address as string) ?? "",
        });
      }
    });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !quotation?.branchId) return;
    getDoc(doc(db, "tenants", tenantId, "branches", quotation.branchId)).then((snap) => {
      if (snap.exists()) setBranch({ id: snap.id, ...snap.data() } as Branch);
    });
  }, [tenantId, quotation?.branchId]);

  async function handleDelete() {
    if (!tenantId || !quotationId || !user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await softDeleteQuotation(tenantId, quotationId, user.uid);
      router.push("/dashboard/quotations");
    } catch {
      setDeleteError(t("quotations.deleteFailed"));
      setIsDeleting(false);
    }
  }

  function handleConvertToOrder() {
    if (!quotation) return;
    router.push(`/dashboard/orders/new?fromQuotation=${quotation.id}`);
  }

  if (!tenantId) return null;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-300" aria-hidden="true" />
      </div>
    );
  }

  if (!quotation) {
    return <div className="p-6 text-center text-sm text-neutral-400">{t("quotations.notFoundMessage")}</div>;
  }

  if (showPrintView && tenantInfo) {
    return (
      <div className="p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setShowPrintView(false)}
          data-print-hide
          className="mb-3 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </button>
        <QuotationPrintView quotation={quotation} items={items} branch={branch} tenant={tenantInfo} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.push("/dashboard/quotations")}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("common.back")}
      </button>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-base font-semibold text-neutral-900">{quotation.quotationNumber}</h1>
              <QuotationStatusBadge status={quotation.status} />
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {quotation.recipientName}
              {quotation.recipientCompany && ` — ${quotation.recipientCompany}`}
            </p>
            <p className="text-xs text-neutral-400">{quotation.recipientPhone}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <QuotationStatusControl
                tenantId={tenantId}
                quotationId={quotation.id}
                currentStatus={quotation.status}
              />
            )}
            <button
              type="button"
              onClick={() => setShowPrintView(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t("quotations.printAction")}
            </button>
          </div>
        </div>

        {quotation.convertedToOrderId ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-status-success/30 bg-status-success/5 p-3 text-sm text-status-success">
            <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("quotations.alreadyConverted")}</span>
            <Link href={`/dashboard/orders/${quotation.convertedToOrderId}`} className="font-medium underline">
              {t("quotations.viewOrder")}
            </Link>
          </div>
        ) : (
          quotation.status === "accepted" &&
          canManage && (
            <button
              type="button"
              onClick={handleConvertToOrder}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-status-success px-4 text-sm font-medium text-white hover:bg-status-success/90 sm:w-auto"
            >
              <ArrowRightCircle className="h-4 w-4" aria-hidden="true" />
              {t("quotations.convertToOrder")}
            </button>
          )
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">{t("quotations.itemsSection")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase text-neutral-500">
                <th className="py-2">{t("quotations.itemName")}</th>
                <th className="py-2 text-right">{t("quotations.quantity")}</th>
                <th className="py-2 text-right">{t("quotations.unitPrice")}</th>
                <th className="py-2 text-right">{t("quotations.lineTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-50">
                  <td className="py-2">
                    {item.itemName}
                    {item.description && <p className="text-xs text-neutral-400">{item.description}</p>}
                  </td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{formatTaka(item.unitPrice)}</td>
                  <td className="py-2 text-right font-medium">{formatTaka(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3">
          <span className="mr-3 text-sm font-medium text-neutral-600">{t("quotations.totalAmount")}</span>
          <span className="font-mono text-base font-semibold text-brand-primary">{formatTaka(quotation.totalAmount)}</span>
        </div>
      </div>

      {(quotation.terms || quotation.notes) && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          {quotation.terms && (
            <div className="mb-3">
              <h2 className="mb-1 text-xs font-semibold uppercase text-neutral-400">{t("quotations.terms")}</h2>
              <p className="whitespace-pre-line text-neutral-700">{quotation.terms}</p>
            </div>
          )}
          {quotation.notes && (
            <div>
              <h2 className="mb-1 text-xs font-semibold uppercase text-neutral-400">{t("quotations.notes")}</h2>
              <p className="whitespace-pre-line text-neutral-600">{quotation.notes}</p>
            </div>
          )}
        </div>
      )}

      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-status-danger/30 px-3 text-sm font-medium text-status-danger hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t("common.delete")}
          </button>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("quotations.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("quotations.confirmDeleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-status-danger">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-status-danger text-white hover:bg-status-danger/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
