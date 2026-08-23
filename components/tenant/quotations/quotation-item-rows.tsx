"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcEffectiveLineTotal, deriveUnitPriceFromTotal, findItemMasterMatch, round2 } from "@/lib/utils/calculations";
import { addAttributeOption } from "@/lib/firebase/items";
import type { QuotationItemFormRow } from "@/lib/types/quotation";
import type { ItemMasterEntry } from "@/lib/types/order";

interface QuotationItemRowsProps {
  rows: QuotationItemFormRow[];
  onChange: (rows: QuotationItemFormRow[]) => void;
  error?: string;
  /** Module T-06 — matched by exact name to auto-fill unitPrice; see updateRow(). */
  itemMasterOptions?: ItemMasterEntry[];
  /** Item Variants ধাপ ২ (১২ আগস্ট ২০২৬) — order-item-rows.tsx-এর identical প্যাটার্ন, দেখুন সেখানকার কমেন্ট। */
  tenantId?: string | null;
  onItemMasterEntryUpdated?: (updated: ItemMasterEntry) => void;
}

function newRow(): QuotationItemFormRow {
  return {
    rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemName: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    totalOverride: null,
    selectedAttributes: [],
  };
}

export function QuotationItemRows({
  rows,
  onChange,
  error,
  itemMasterOptions = [],
  tenantId = null,
  onItemMasterEntryUpdated,
}: QuotationItemRowsProps) {
  const t = useTranslations();
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function updateAttributeSelection(
    rowId: string,
    matchedItem: ItemMasterEntry,
    groupId: string,
    groupName: string,
    optionId: string,
    optionLabel: string,
    priceAdjustment: number
  ) {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    const withoutGroup = row.selectedAttributes.filter((a) => a.groupId !== groupId);
    const nextSelected = optionId
      ? [...withoutGroup, { groupId, groupName, optionId, optionLabel, priceAdjustment }]
      : withoutGroup;
    const nextUnitPrice = round2(
      matchedItem.defaultUnitPrice + nextSelected.reduce((sum, a) => sum + a.priceAdjustment, 0)
    );
    updateRow(rowId, { selectedAttributes: nextSelected, unitPrice: nextUnitPrice, totalOverride: null });
  }

  async function handleAddCustomOption(
    rowId: string,
    matchedItem: ItemMasterEntry,
    groupId: string,
    groupName: string
  ) {
    const key = `${rowId}-${groupId}`;
    const label = (customInputs[key] ?? "").trim();
    if (!label || !tenantId) return;
    setSavingKey(key);
    try {
      const opt = await addAttributeOption(tenantId, matchedItem.id, groupId, groupName, label);
      updateAttributeSelection(rowId, matchedItem, groupId, groupName, opt.optionId, opt.optionLabel, opt.priceAdjustment);
      if (onItemMasterEntryUpdated) {
        const groups = (matchedItem.attributeGroups ?? []).map((g) => ({ ...g, options: [...g.options] }));
        let group = groups.find((g) => g.id === groupId);
        if (!group) {
          group = { id: groupId, name: groupName, options: [] };
          groups.push(group);
        }
        if (!group.options.some((o) => o.id === opt.optionId)) {
          group.options.push({ id: opt.optionId, label: opt.optionLabel, priceAdjustment: opt.priceAdjustment });
        }
        onItemMasterEntryUpdated({ ...matchedItem, attributeGroups: groups });
      }
      setCustomInputs((prev) => ({ ...prev, [key]: "" }));
    } finally {
      setSavingKey(null);
    }
  }

  function updateRow(rowId: string, patch: Partial<QuotationItemFormRow>) {
    onChange(
      rows.map((r) => {
        if (r.rowId !== rowId) return r;
        const next = { ...r, ...patch };
        if (patch.itemName !== undefined && r.unitPrice === 0 && r.totalOverride === null) {
          const match = findItemMasterMatch(itemMasterOptions, patch.itemName);
          if (match) next.unitPrice = match.defaultUnitPrice;
        }
        return next;
      })
    );
  }

  /** User typed per-piece price directly — clears any earlier total
   *  override (৩০ জুলাই ২০২৬ ফিচার, see order-item-rows.tsx's identical
   *  handler for the full reasoning). */
  function handleUnitPriceChange(rowId: string, value: number) {
    updateRow(rowId, { unitPrice: Math.max(0, value || 0), totalOverride: null });
  }

  /** User typed the line TOTAL directly — becomes authoritative; unitPrice
   *  is only a derived, rounded display value and is never multiplied back
   *  by quantity to re-derive the total. */
  function handleTotalChange(rowId: string, value: number) {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    const total = round2(Math.max(0, value || 0));
    updateRow(rowId, {
      totalOverride: total,
      unitPrice: deriveUnitPriceFromTotal(total, row.quantity || 0),
    });
  }

  /** Quantity changed — if total is pinned, keep it fixed and only
   *  re-derive unitPrice; otherwise normal quantity × unitPrice mode. */
  function handleQuantityChange(rowId: string, value: number) {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    const quantity = Math.max(0, value || 0);
    if (row.totalOverride !== null) {
      updateRow(rowId, { quantity, unitPrice: deriveUnitPriceFromTotal(row.totalOverride, quantity) });
    } else {
      updateRow(rowId, { quantity });
    }
  }

  function removeRow(rowId: string) {
    onChange(rows.filter((r) => r.rowId !== rowId));
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const matchedItem = findItemMasterMatch(itemMasterOptions, row.itemName);
        const attributeGroups = matchedItem?.attributeGroups ?? [];
        return (
        <div key={row.rowId} className="rounded-lg border border-neutral-200 p-3">
          <div className="grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <Label htmlFor={`qitem-name-${row.rowId}`}>
                {t("quotations.itemName")} {index === 0 ? "*" : ""}
              </Label>
              <Input
                id={`qitem-name-${row.rowId}`}
                value={row.itemName}
                onChange={(e) => updateRow(row.rowId, { itemName: e.target.value })}
                placeholder={t("quotations.itemNamePlaceholder")}
                list={itemMasterOptions.length > 0 ? `qitem-master-options-${row.rowId}` : undefined}
              />
              {itemMasterOptions.length > 0 && (
                <datalist id={`qitem-master-options-${row.rowId}`}>
                  {itemMasterOptions.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`qitem-qty-${row.rowId}`}>{t("quotations.quantity")}</Label>
              <Input
                id={`qitem-qty-${row.rowId}`}
                type="number"
                min={0}
                step="any"
                value={row.quantity}
                onChange={(e) => handleQuantityChange(row.rowId, Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`qitem-price-${row.rowId}`}>{t("quotations.unitPrice")}</Label>
              <Input
                id={`qitem-price-${row.rowId}`}
                type="number"
                min={0}
                step="any"
                value={row.unitPrice}
                onChange={(e) => handleUnitPriceChange(row.rowId, Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`qitem-total-${row.rowId}`}>{t("quotations.lineTotal")}</Label>
              <Input
                id={`qitem-total-${row.rowId}`}
                type="number"
                min={0}
                step="any"
                value={calcEffectiveLineTotal(row.quantity || 0, row.unitPrice || 0, row.totalOverride)}
                onChange={(e) => handleTotalChange(row.rowId, Number(e.target.value))}
              />
            </div>
            <div className="flex items-end justify-end sm:col-span-1">
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.rowId)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-status-danger hover:bg-red-50"
                  aria-label={t("common.delete")}
                  title={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {attributeGroups.length > 0 && matchedItem && (
            <div className="mt-2 rounded-lg bg-neutral-50 p-2.5">
              <p className="mb-1.5 text-xs font-medium text-neutral-500">{t("orders.selectVariant")}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {attributeGroups.map((group) => {
                  const selected = row.selectedAttributes.find((a) => a.groupId === group.id);
                  const key = `${row.rowId}-${group.id}`;
                  const isAddingNew = customInputs[key] !== undefined;
                  return (
                    <div key={group.id}>
                      <Label htmlFor={`qattr-${row.rowId}-${group.id}`} className="text-xs">
                        {group.name}
                      </Label>
                      {!isAddingNew ? (
                        <select
                          id={`qattr-${row.rowId}-${group.id}`}
                          value={selected?.optionId ?? ""}
                          onChange={(e) => {
                            if (e.target.value === "__new__") {
                              setCustomInputs((prev) => ({ ...prev, [key]: "" }));
                              return;
                            }
                            const option = group.options.find((o) => o.id === e.target.value);
                            updateAttributeSelection(
                              row.rowId,
                              matchedItem,
                              group.id,
                              group.name,
                              option?.id ?? "",
                              option?.label ?? "",
                              option?.priceAdjustment ?? 0
                            );
                          }}
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        >
                          <option value="">{t("orders.selectVariantOption")}</option>
                          {group.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                              {option.priceAdjustment !== 0
                                ? ` (${option.priceAdjustment > 0 ? "+" : ""}${option.priceAdjustment})`
                                : ""}
                            </option>
                          ))}
                          <option value="__new__">{t("orders.addNewVariantOption")}</option>
                        </select>
                      ) : (
                        <div className="flex gap-1">
                          <Input
                            autoFocus
                            value={customInputs[key] ?? ""}
                            onChange={(e) => setCustomInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder={t("orders.newVariantOptionPlaceholder")}
                            className="h-9 text-sm"
                          />
                          <button
                            type="button"
                            disabled={savingKey === key || !(customInputs[key] ?? "").trim()}
                            onClick={() => handleAddCustomOption(row.rowId, matchedItem, group.id, group.name)}
                            className="h-9 shrink-0 rounded-lg bg-brand-primary px-2.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {t("common.add")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomInputs((prev) => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              })
                            }
                            className="h-9 shrink-0 rounded-lg border border-neutral-200 px-2 text-xs text-neutral-500"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-2">
            <Label htmlFor={`qitem-desc-${row.rowId}`}>{t("quotations.itemDescription")}</Label>
            <Input
              id={`qitem-desc-${row.rowId}`}
              value={row.description}
              onChange={(e) => updateRow(row.rowId, { description: e.target.value })}
              placeholder={t("quotations.itemDescriptionPlaceholder")}
            />
          </div>
        </div>
      );})}

      {error && <p className="text-xs text-status-danger">{error}</p>}

      <button
        type="button"
        onClick={() => onChange([...rows, newRow()])}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("quotations.addAnotherItem")}
      </button>
    </div>
  );
}

export { newRow as createEmptyQuotationItemRow };
