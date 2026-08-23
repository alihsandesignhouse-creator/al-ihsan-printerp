"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusCircle, Search, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { subscribeItems, loadMoreItems } from "@/lib/firebase/items";
import { ItemListTable } from "@/components/tenant/items/item-list-table";
import { ItemFormDialog } from "@/components/tenant/items/item-form-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ItemMasterEntry } from "@/lib/types/order";

export default function ItemMasterListPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const role = user?.claims.role;
  const canManage = role === "tenant_admin" || role === "branch_manager";
  const handleFirestoreError = useFirestoreErrorHandler();

  const [items, setItems] = useState<ItemMasterEntry[]>([]);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemMasterEntry | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);
    const unsub = subscribeItems(
      tenantId,
      (data, hasMore) => {
        setItems(data);
        setHasMoreItems(hasMore);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, handleFirestoreError]);

  async function handleLoadMoreItems() {
    if (!tenantId || isLoadingMoreItems) return;
    const last = items[items.length - 1];
    if (!last) return;
    setIsLoadingMoreItems(true);
    try {
      const { items: nextBatch, hasMore } = await loadMoreItems(tenantId, last);
      setItems((prev) => [...prev, ...nextBatch]);
      setHasMoreItems(hasMore);
    } catch (error) {
      handleFirestoreError()(error as Error);
    } finally {
      setIsLoadingMoreItems(false);
    }
  }

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.name.toLowerCase().includes(term));
  }, [items, search]);

  function openCreate() {
    setEditingItem(null);
    setFormOpen(true);
  }

  function openEdit(item: ItemMasterEntry) {
    setEditingItem(item);
    setFormOpen(true);
  }

  if (!tenantId || !user) return null;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">{t("itemMaster.pageTitle")}</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {t("itemMaster.newItem")}
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("itemMaster.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {hasMoreItems && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("itemMaster.moreItemsAvailable", { count: items.length })}</p>
        </div>
      )}

      <ItemListTable
        tenantId={tenantId}
        userId={user.uid}
        items={filteredItems}
        isLoading={isLoading}
        canManage={canManage}
        onEdit={openEdit}
      />

      {hasMoreItems && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMoreItems}
            disabled={isLoadingMoreItems}
            className="flex h-10 items-center gap-2 rounded-lg border border-brand-primary px-4 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreItems && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("itemMaster.loadMore")}
          </button>
        </div>
      )}

      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} tenantId={tenantId} editingItem={editingItem} />
    </div>
  );
}
