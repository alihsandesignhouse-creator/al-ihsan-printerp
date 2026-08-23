"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuditLogFiltersBar } from "@/components/tenant/audit-log/audit-log-filters-bar";
import { AuditLogDetailDialog } from "@/components/tenant/audit-log/audit-log-detail-dialog";
import { CrossTenantAuditTable } from "@/components/super-admin/settings/cross-tenant-audit-table";
import {
  fetchCrossTenantAuditLogPage,
  fetchTenantNameMap,
  type CrossTenantAuditLogPage,
} from "@/lib/firebase/super-admin-audit";
import type { AuditLog, AuditCategory } from "@/lib/types/audit";

/**
 * components/super-admin/settings/cross-tenant-audit-log-tab.tsx — SA-05
 * "অডিট লগ" tab. Same filter/pagination shape as the tenant_admin-facing
 * app/(tenant)/dashboard/audit-log/page.tsx (category + date server-side,
 * user/tenant-name search client-side over the current page) but reading
 * across every tenant via `fetchCrossTenantAuditLogPage`'s collectionGroup
 * query, with an added tenant-name resolution step so each row shows which
 * press it belongs to.
 */
export function CrossTenantAuditLogTab() {
  const t = useTranslations();

  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tenantNames, setTenantNames] = useState<Map<string, string>>(new Map());
  const [cursor, setCursor] = useState<CrossTenantAuditLogPage["cursor"]>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchTenantNameMap()
      .then(setTenantNames)
      .catch(() => setTenantNames(new Map()));
  }, []);

  const loadFirstPage = useCallback(() => {
    setIsLoading(true);
    setError(false);
    fetchCrossTenantAuditLogPage({
      resourceType: category === "all" ? null : category,
      from: from ? new Date(`${from}T00:00:00`) : null,
      to: to ? new Date(`${to}T23:59:59`) : null,
    })
      .then((page) => {
        setLogs(page.logs);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [category, from, to]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchCrossTenantAuditLogPage({
        resourceType: category === "all" ? null : category,
        from: from ? new Date(`${from}T00:00:00`) : null,
        to: to ? new Date(`${to}T23:59:59`) : null,
        cursor,
      });
      setLogs((prev) => [...prev, ...page.logs]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch {
      setError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => {
      const tenantName = (tenantNames.get(log.tenantId) ?? log.tenantId).toLowerCase();
      return log.userEmail.toLowerCase().includes(term) || tenantName.includes(term);
    });
  }, [logs, search, tenantNames]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">{t("sa.settingsPage.auditLog.subtitle")}</p>

      <AuditLogFiltersBar
        category={category}
        onCategoryChange={setCategory}
        from={from}
        onFromChange={setFrom}
        to={to}
        onToChange={setTo}
        search={search}
        onSearchChange={setSearch}
      />

      {error ? (
        <p className="text-sm text-status-danger">{t("auditLog.loadFailed")}</p>
      ) : (
        <>
          <CrossTenantAuditTable
            logs={visibleLogs}
            tenantNames={tenantNames}
            isLoading={isLoading}
            onSelect={setSelectedLog}
          />

          {!isLoading && hasMore && (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  t("auditLog.loadMore")
                )}
              </Button>
            </div>
          )}
        </>
      )}

      <AuditLogDetailDialog log={selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)} />
    </div>
  );
}
