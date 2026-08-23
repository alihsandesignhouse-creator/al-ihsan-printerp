"use client";

/**
 * "কাস্টমার + সাপ্লায়ার একই ব্যক্তি" ফিচার, ধাপ ২ (১৭ আগস্ট ২০২৬) —
 * আগে এই কম্পোনেন্টটা components/tenant/orders/order-item-rows.tsx-এ ছিল
 * ও শুধু অর্ডার ফর্মে ব্যবহৃত হতো। এখন এটা এখানে (components/shared/) সরিয়ে
 * আনা হয়েছে যাতে অর্ডার ফর্ম (components/tenant/orders/order-form.tsx) ও
 * নতুন সাপ্লায়ার "ক্রয় করুন" ফর্ম (components/tenant/suppliers/
 * purchase-form.tsx) দুটোই একই কম্পোনেন্ট ব্যবহার করে — ভবিষ্যতে আইটেম-রো
 * UI-তে কোনো পরিবর্তন আনলে দুই জায়গাতেই এক সাথে প্রতিফলিত হবে। কোনো
 * লজিক বদলানো হয়নি, শুধু ফাইল সরানো ও কম্পোনেন্টের নাম
 * OrderItemRows → TransactionItemRows হয়েছে।
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcEffectiveLineTotal, deriveUnitPriceFromTotal, findItemMasterMatch, round2 } from "@/lib/utils/calculations";
import { addAttributeOption } from "@/lib/firebase/items";
import type { OrderItemFormRow } from "@/lib/types/order";
import type { ItemMasterEntry } from "@/lib/types/order";

interface TransactionItemRowsProps {
  rows: OrderItemFormRow[];
  onChange: (rows: OrderItemFormRow[]) => void;
  error?: string;
  /** Module T-06 — matched by exact name to auto-fill unitPrice; see updateRow(). */
  itemMasterOptions?: ItemMasterEntry[];
  /** নতুন সাইজ/কালার অপশন টাইপ করে যোগ করলে (Item Variants ধাপ ১, ১২ আগস্ট
   *  ২০২৬) parent-এর itemMasterOptions state-এ patched আইটেমটা বসাতে হবে,
   *  নাহলে নতুন অপশনটা dropdown-এ তখনই দেখা যাবে না (রিফ্রেশ ছাড়া)। */
  tenantId?: string | null;
  onItemMasterEntryUpdated?: (updated: ItemMasterEntry) => void;
}

function newRow(): OrderItemFormRow {
  return {
    rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemName: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    totalOverride: null,
    addToItemMaster: false,
    selectedAttributes: [],
  };
}

export function TransactionItemRows({
  rows,
  onChange,
  error,
  itemMasterOptions = [],
  tenantId = null,
  onItemMasterEntryUpdated,
}: TransactionItemRowsProps) {
  const t = useTranslations();
  // key = `${rowId}-${groupId}` → এই cell-এ এখন "নতুন লিখুন" ইনপুট খোলা +
  // টাইপ করা টেক্সট। শুধু UI-state, ফর্ম ডেটার অংশ না।
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

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
      // parent-এর itemMasterOptions-এ নতুন অপশনসহ গ্রুপ patch করা — আগের
      // addAttributeOption()-এর কমেন্টে ব্যাখ্যা করা কারণে।
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

  function updateRow(rowId: string, patch: Partial<OrderItemFormRow>) {
    onChange(
      rows.map((r) => {
        if (r.rowId !== rowId) return r;
        const next = { ...r, ...patch };
        // Auto-fill the default price when the typed name exactly matches an
        // item master entry and the user hasn't already set a price for this
        // row — "স্বয়ংক্রিয় পূরণ, পরিবর্তনযোগ্য" (blueprint T-06): it only
        // pre-fills, the field stays freely editable afterward.
        if (patch.itemName !== undefined) {
          const match = findItemMasterMatch(itemMasterOptions, patch.itemName);
          if (r.unitPrice === 0 && r.totalOverride === null && match) {
            next.unitPrice = match.defaultUnitPrice;
          }
          // নাম বদলে অন্য আইটেমে (বা কোনো আইটেমেই না) গেলে আগের
          // ভ্যারিয়েন্ট বাছাই আর প্রাসঙ্গিক থাকে না — audit #৪, ধাপ ২।
          const previousMatch = findItemMasterMatch(itemMasterOptions, r.itemName);
          if (previousMatch?.id !== match?.id) {
            next.selectedAttributes = [];
          }
        }
        return next;
      })
    );
  }

  /**
   * আইটেম-ভ্যারিয়েন্ট গ্রুপের একটা অপশন বাছাই/বদলানো (audit #৪, ধাপ ২)।
   * একক মূল্য পুনর্গণনা করা হয়: matchedItem.defaultUnitPrice + সব বাছাই
   * করা অপশনের priceAdjustment-এর যোগফল — এটাই নতুন "প্রামাণিক" মূল্য
   * হিসেবে বসে (সরাসরি একক মূল্য টাইপ করার সাথে সামঞ্জস্যপূর্ণ আচরণ,
   * তাই totalOverride রিসেট হয়)।
   */
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

  /** User typed per-piece price directly — this is the authoritative source
   *  again, so any earlier total override is cleared (৩০ জুলাই ২০২৬ ফিচার,
   *  see lib/utils/calculations.ts's calcEffectiveLineTotal()). */
  function handleUnitPriceChange(rowId: string, value: number) {
    updateRow(rowId, { unitPrice: Math.max(0, value || 0), totalOverride: null });
  }

  /** User typed the line TOTAL directly — this becomes the authoritative
   *  source; unitPrice is derived (total ÷ quantity, round2()'d for
   *  display) but the total itself is stored exactly as typed and is never
   *  recomputed from that rounded unitPrice. */
  function handleTotalChange(rowId: string, value: number) {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    const total = round2(Math.max(0, value || 0));
    updateRow(rowId, {
      totalOverride: total,
      unitPrice: deriveUnitPriceFromTotal(total, row.quantity || 0),
    });
  }

  /** Quantity changed. If this row's total was manually pinned, the total
   *  stays fixed and only the derived per-piece price is recalculated —
   *  otherwise (normal mode) only quantity changes and the total
   *  recalculates from quantity × unitPrice as before. */
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
              <Label htmlFor={`itemName-${row.rowId}`}>
                {t("orders.itemName")} {index === 0 ? "*" : ""}
              </Label>
              <Input
                id={`itemName-${row.rowId}`}
                value={row.itemName}
                onChange={(e) => updateRow(row.rowId, { itemName: e.target.value })}
                placeholder={t("orders.itemNamePlaceholder")}
                list={itemMasterOptions.length > 0 ? `item-master-options-${row.rowId}` : undefined}
              />
              {itemMasterOptions.length > 0 && (
                <datalist id={`item-master-options-${row.rowId}`}>
                  {itemMasterOptions.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`qty-${row.rowId}`}>{t("orders.quantity")}</Label>
              <Input
                id={`qty-${row.rowId}`}
                type="number"
                min={0}
                step="any"
                value={row.quantity}
                onChange={(e) => handleQuantityChange(row.rowId, Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`price-${row.rowId}`}>{t("orders.unitPrice")}</Label>
              <Input
                id={`price-${row.rowId}`}
                type="number"
                min={0}
                step="any"
                value={row.unitPrice}
                onChange={(e) => handleUnitPriceChange(row.rowId, Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`total-${row.rowId}`}>{t("orders.lineTotal")}</Label>
              <Input
                id={`total-${row.rowId}`}
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
                      <Label htmlFor={`attr-${row.rowId}-${group.id}`} className="text-xs">
                        {group.name}
                      </Label>
                      {!isAddingNew ? (
                        <select
                          id={`attr-${row.rowId}-${group.id}`}
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

          <div className="mt-2 grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-8">
              <Label htmlFor={`desc-${row.rowId}`}>{t("orders.itemDescription")}</Label>
              <Input
                id={`desc-${row.rowId}`}
                value={row.description}
                onChange={(e) => updateRow(row.rowId, { description: e.target.value })}
                placeholder={t("orders.itemDescriptionPlaceholder")}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-4 sm:items-end sm:pb-2.5">
              <input
                id={`master-${row.rowId}`}
                type="checkbox"
                checked={row.addToItemMaster}
                onChange={(e) => updateRow(row.rowId, { addToItemMaster: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
              />
              <label htmlFor={`master-${row.rowId}`} className="text-xs text-neutral-600">
                {t("orders.addToItemMaster")}
              </label>
            </div>
          </div>
        </div>
        );
      })}

      {error && <p className="text-xs text-status-danger">{error}</p>}

      <button
        type="button"
        onClick={() => onChange([...rows, newRow()])}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("orders.addAnotherItem")}
      </button>
    </div>
  );
}

export { newRow as createEmptyTransactionItemRow };
