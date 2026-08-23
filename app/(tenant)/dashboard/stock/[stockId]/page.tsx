"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Pencil, SlidersHorizontal } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { subscribeStockItem, subscribeStockTransactions } from "@/lib/firebase/stock";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { StockTransactionHistory } from "@/components/tenant/stock/stock-transaction-history";
import { StockTransactionModal } from "@/components/tenant/stock/stock-transaction-modal";
import { StockItemFormDialog } from "@/components/tenant/stock/stock-item-form";
import { Button } from "@/components/ui/button";
import type { Branch } from "@/lib/types/dashboard";
import type { StockItem, StockTransaction, StockTransactionType } from "@/lib/types/stock";

export default function StockItemDetailPage() {
  const t = useTranslations();
  const params = useParams<{ stockId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const canManage = role === "tenant_admin" || role === "branch_manager";
  const handleFirestoreError = useFirestoreErrorHandler();

  const [item, setItem] = useState<StockItem | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [isLoadingItem, setIsLoadingItem] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(true);

  const [txOpen, setTxOpen] = useState(false);
  const [txType, setTxType] = useState<StockTransactionType>("in");
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !params.stockId) return;
    setIsLoadingItem(true);
    const unsub = subscribeStockItem(
      tenantId,
      params.stockId,
      (data) => {
        setItem(data);
        setIsLoadingItem(false);
      },
      handleFirestoreError(() => setIsLoadingItem(false))
    );
    return () => unsub();
  }, [tenantId, params.stockId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !params.stockId) return;
    setIsLoadingTx(true);
    const unsub = subscribeStockTransactions(
      tenantId,
      params.stockId,
      (data) => {
        setTransactions(data);
        setIsLoadingTx(false);
      },
      handleFirestoreError(() => setIsLoadingTx(false))
    );
    return () => unsub();
  }, [tenantId, params.stockId, handleFirestoreError]);

  function openTransaction(type: StockTransactionType) {
    setTxType(type);
    setTxOpen(true);
  }

  if (!tenantId) return null;

  if (!isLoadingItem && !item) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/stock")}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </button>
        <p className="text-sm text-neutral-400">{t("stock.notFound")}</p>
      </div>
    );
  }

  const branchName = item ? branches.find((b) => b.id === item.branchId)?.name ?? "" : "";
  const isLow = item ? item.currentStock <= item.minimumLevel : false;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.push("/dashboard/stock")}
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("stock.pageTitle")}
      </button>

      {isLoadingItem || !item ? (
        <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">{item.name}</h1>
              <p className="mt-1 text-sm text-neutral-500">
                {item.category || t("stock.noCategory")} · {branchName}
              </p>
            </div>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t("common.edit")}
              </Button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className={`rounded-lg px-4 py-3 ${isLow ? "bg-amber-50" : "bg-neutral-50"}`}>
              <p className="text-xs text-neutral-500">{t("stock.currentStock")}</p>
              <p className={`mt-1 text-xl font-semibold ${isLow ? "text-status-danger" : "text-neutral-900"}`}>
                {item.currentStock} <span className="text-sm font-normal text-neutral-400">{item.unit}</span>
              </p>
            </div>
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <p className="text-xs text-neutral-500">{t("stock.minimumLevel")}</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">
                {item.minimumLevel} <span className="text-sm font-normal text-neutral-400">{item.unit}</span>
              </p>
            </div>
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <p className="text-xs text-neutral-500">{t("stock.statusColumn")}</p>
              <p className={`mt-1 text-xl font-semibold ${isLow ? "text-status-danger" : "text-status-success"}`}>
                {isLow ? t("stock.statusLow") : t("stock.statusNormal")}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openTransaction("in")}>
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                {t("stock.type.in")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => openTransaction("out")}>
                <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                {t("stock.type.out")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openTransaction("adjustment")}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {t("stock.type.adjustment")}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-700">{t("stock.transactionHistory")}</h2>
        <StockTransactionHistory transactions={transactions} unit={item?.unit ?? ""} isLoading={isLoadingTx} />
      </div>

      <StockTransactionModal
        open={txOpen}
        onOpenChange={setTxOpen}
        tenantId={tenantId}
        item={item}
        defaultType={txType}
      />

      <StockItemFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenantId={tenantId}
        branches={branches}
        defaultBranchId={item?.branchId ?? "all"}
        editingItem={item}
      />
    </div>
  );
}
