"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator, FileWarning, Link2, Loader2, PencilLine, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { subscribeOrderCosting, saveOrderCosting } from "@/lib/firebase/order-costing";
import { subscribeSuppliers, linkCostingToSupplierLedger } from "@/lib/firebase/suppliers";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeCostCalculations } from "@/lib/firebase/cost-calculator";
import { calcTotalCosting, calcGrossProfit } from "@/lib/utils/order-costing-math";
import { formatTaka } from "@/lib/utils/calculations";
import type { OrderCosting } from "@/lib/types/order-costing";
import type { CostCalculation } from "@/lib/types/cost-calculator";
import type { Supplier } from "@/lib/types/supplier";

interface OrderCostingSectionProps {
  tenantId: string;
  userId: string;
  userName: string;
  order: { id: string; orderNumber: string; branchId: string; totalAmount: number };
  canEdit: boolean;
  /** শুধু tenant_admin/branch_manager — সাপ্লায়ার লেজারে "যোগ করুন" বাটন এদের জন্যই দেখানো হয়, কারণ firestore.rules-এ supplier_transactions create শুধু এই দুই রোলের জন্য অনুমোদিত। */
  canManageSupplierLedger: boolean;
}

export function OrderCostingSection({
  tenantId,
  userId,
  userName,
  order,
  canEdit,
  canManageSupplierLedger,
}: OrderCostingSectionProps) {
  const t = useTranslations();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [costing, setCosting] = useState<OrderCosting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const [rawMaterialCost, setRawMaterialCost] = useState(0);
  const [laborCost, setLaborCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [note, setNote] = useState("");
  const [sourceCalculationId, setSourceCalculationId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const [calculations, setCalculations] = useState<CostCalculation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeOrderCosting(
      tenantId,
      order.id,
      (data) => {
        setCosting(data);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return unsub;
  }, [tenantId, order.id, handleFirestoreError]);

  useEffect(() => {
    const unsub = subscribeCostCalculations(tenantId, order.branchId, setCalculations, handleFirestoreError());
    return unsub;
  }, [tenantId, order.branchId, handleFirestoreError]);

  useEffect(() => {
    const unsub = subscribeSuppliers(tenantId, order.branchId, setSuppliers, handleFirestoreError());
    return unsub;
  }, [tenantId, order.branchId, handleFirestoreError]);

  function startEditing() {
    setRawMaterialCost(costing?.rawMaterialCost ?? 0);
    setLaborCost(costing?.laborCost ?? 0);
    setOtherCost(costing?.otherCost ?? 0);
    setNote(costing?.note ?? "");
    setSourceCalculationId(costing?.sourceCalculationId ?? null);
    setSupplierId(costing?.supplierId ?? null);
    setIsEditing(true);
  }

  function applyImport(calcId: string) {
    setSourceCalculationId(calcId || null);
    if (!calcId) return;
    const source = calculations.find((c) => c.id === calcId);
    if (source) setRawMaterialCost(source.totalProductionCost);
  }

  const totalCosting = useMemo(
    () => calcTotalCosting(rawMaterialCost, laborCost, otherCost),
    [rawMaterialCost, laborCost, otherCost]
  );
  const grossProfit = useMemo(() => calcGrossProfit(order.totalAmount, totalCosting), [order.totalAmount, totalCosting]);

  // সাপ্লায়ার একবার লেজারে লিংক হয়ে গেলে (supplier_transactions append-only
  // বলে unlink সম্ভব না) dropdown লক থাকবে — ভুল সংশোধন লাগলে সাপ্লায়ার
  // পেজ থেকে আলাদা এন্ট্রি দিতে হবে।
  const isSupplierLocked = Boolean(costing?.supplierTransactionId);

  async function handleSave() {
    setIsSaving(true);
    try {
      const supplier = suppliers.find((s) => s.id === supplierId) ?? null;
      await saveOrderCosting(tenantId, userId, userName, order, {
        rawMaterialCost,
        laborCost,
        otherCost,
        note,
        sourceCalculationId,
        supplierId: isSupplierLocked ? (costing?.supplierId ?? null) : supplierId,
        supplierName: isSupplierLocked ? (costing?.supplierName ?? null) : (supplier?.name ?? null),
      });
      toast.success(t("orderCosting.saved"));
      setIsEditing(false);
    } catch {
      toast.error(t("orderCosting.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLinkToLedger() {
    if (!costing?.supplierId || !costing.rawMaterialCost) return;
    setIsLinking(true);
    try {
      await linkCostingToSupplierLedger(
        tenantId,
        userId,
        userName,
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          supplierId: costing.supplierId,
          rawMaterialCost: costing.rawMaterialCost,
        },
        t("orderCosting.supplierLedgerNote", { orderNumber: order.orderNumber })
      );
      toast.success(t("orderCosting.supplierLedgerLinked"));
    } catch {
      toast.error(t("orderCosting.supplierLedgerLinkFailed"));
    } finally {
      setIsLinking(false);
    }
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />;
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-neutral-900">{t("orderCosting.title")}</h2>
        </div>

        {!isEditing && canEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={startEditing}>
            <PencilLine className="h-4 w-4" aria-hidden="true" />
            {costing ? t("common.edit") : t("orderCosting.addCosting")}
          </Button>
        )}
      </div>

      {!isEditing && !costing && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          <FileWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("orderCosting.noCosting")}
        </div>
      )}

      {!isEditing && costing && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-neutral-500">{t("orderCosting.rawMaterialCost")}</p>
              <p className="font-medium text-neutral-800">{formatTaka(costing.rawMaterialCost)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{t("orderCosting.laborCost")}</p>
              <p className="font-medium text-neutral-800">{formatTaka(costing.laborCost)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{t("orderCosting.otherCost")}</p>
              <p className="font-medium text-neutral-800">{formatTaka(costing.otherCost)}</p>
            </div>
          </div>

          {costing.supplierId && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 p-2.5">
              <div className="flex-1">
                <p className="text-xs text-neutral-500">{t("orderCosting.supplier")}</p>
                <p className="font-medium text-neutral-800">{costing.supplierName}</p>
              </div>
              {costing.supplierTransactionId ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  {t("orderCosting.supplierLedgerLinked")}
                </span>
              ) : (
                canManageSupplierLedger && (
                  <Button type="button" size="sm" variant="outline" onClick={handleLinkToLedger} disabled={isLinking}>
                    {isLinking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {t("orderCosting.addToSupplierLedger")}
                  </Button>
                )
              )}
            </div>
          )}

          {costing.note && <p className="text-xs text-neutral-500">{costing.note}</p>}
          <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
            <span className="text-neutral-600">{t("orderCosting.totalCosting")}</span>
            <span className="font-semibold text-neutral-900">{formatTaka(costing.totalCosting)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-700">{t("orderCosting.grossProfit")}</span>
            <span
              className={`text-base font-semibold ${grossProfit >= 0 ? "text-status-success" : "text-status-danger"}`}
            >
              {formatTaka(calcGrossProfit(order.totalAmount, costing.totalCosting))}
            </span>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="mt-3 space-y-3">
          {calculations.length > 0 && (
            <div>
              <Label>{t("orderCosting.importFromCalculator")}</Label>
              <select
                value={sourceCalculationId ?? ""}
                onChange={(e) => applyImport(e.target.value)}
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">{t("orderCosting.selectCalculation")}</option>
                {calculations.map((calc) => (
                  <option key={calc.id} value={calc.id}>
                    {calc.name} — {formatTaka(calc.totalProductionCost)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-400">{t("orderCosting.importHint")}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="rawMaterialCost">{t("orderCosting.rawMaterialCost")}</Label>
              <Input
                id="rawMaterialCost"
                type="number"
                min={0}
                inputMode="decimal"
                value={rawMaterialCost}
                onChange={(e) => setRawMaterialCost(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label htmlFor="laborCost">{t("orderCosting.laborCost")}</Label>
              <Input
                id="laborCost"
                type="number"
                min={0}
                inputMode="decimal"
                value={laborCost}
                onChange={(e) => setLaborCost(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label htmlFor="otherCost">{t("orderCosting.otherCost")}</Label>
              <Input
                id="otherCost"
                type="number"
                min={0}
                inputMode="decimal"
                value={otherCost}
                onChange={(e) => setOtherCost(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="costingSupplier">{t("orderCosting.supplier")}</Label>
            <select
              id="costingSupplier"
              value={supplierId ?? ""}
              onChange={(e) => setSupplierId(e.target.value || null)}
              disabled={isSupplierLocked}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              <option value="">{t("orderCosting.noSupplier")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-400">
              {isSupplierLocked ? t("orderCosting.supplierLockedHint") : t("orderCosting.supplierHint")}
            </p>
          </div>

          <div>
            <Label htmlFor="costingNote">{t("orderCosting.note")}</Label>
            <Textarea id="costingNote" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1 rounded-lg bg-neutral-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">{t("orderCosting.totalCosting")}</span>
              <span className="font-semibold text-neutral-900">{formatTaka(totalCosting)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-700">{t("orderCosting.grossProfit")}</span>
              <span className={`font-semibold ${grossProfit >= 0 ? "text-status-success" : "text-status-danger"}`}>
                {formatTaka(grossProfit)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
