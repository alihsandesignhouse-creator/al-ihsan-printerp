"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { History, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchAuditLogPage, type AuditLogPage } from "@/lib/firebase/audit";
import { AuditLogFiltersBar } from "@/components/tenant/audit-log/audit-log-filters-bar";
import { AuditLogTable } from "@/components/tenant/audit-log/audit-log-table";
import { AuditLogDetailDialog } from "@/components/tenant/audit-log/audit-log-detail-dialog";
import { Button } from "@/components/ui/button";
import type { AuditLog, AuditCategory } from "@/lib/types/audit";

/**
 * Module — Audit Log (blueprint ১১.৬)। শুধু Tenant Admin দেখতে পারেন
 * (firestore.rules: "Tenant Admin reads the full log; any active user may
 * read their own entries only" — সেই own-only ভিউ ইতিমধ্যে T-08 ব্যক্তিগত
 * প্রোফাইল পেজে `LoginHistoryList` দিয়ে আছে, এটি সম্পূর্ণ আলাদা: পুরো
 * প্রতিষ্ঠানের সব ব্যবহারকারীর সব গুরুত্বপূর্ণ কার্যক্রম)।
 *
 * ক্যাটাগরি ফিল্টার সার্ভার-সাইড (resourceType-এ ইনডেক্সড কোয়েরি);
 * তারিখ-রেঞ্জ সার্ভার-সাইড (createdAt-এ, একই ফিল্ড, নতুন ইনডেক্স লাগে না);
 * ইউজার-ইমেইল সার্চ ক্লায়েন্ট-সাইড (বর্তমান পেজের উপর) — একটি পূর্ণ
 * টেক্সট-সার্চ ইনডেক্স শুধু এই একটি সার্চ বক্সের জন্য যোগ করা অপ্রয়োজনীয়
 * জটিলতা।
 */
export default function AuditLogPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.claims.role;
  const tenantId = user?.claims.tenantId ?? null;

  // Only tenant_admin can access this page; middleware + layout guard it,
  // but we also render null here defensively (same pattern as
  // app/(tenant)/dashboard/users/page.tsx).
  if (role !== "tenant_admin") return null;

  return tenantId ? <AuditLogPageContent tenantId={tenantId} /> : null;
}

function AuditLogPageContent({ tenantId }: { tenantId: string }) {
  const t = useTranslations();

  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [cursor, setCursor] = useState<AuditLogPage["cursor"]>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadFirstPage = useCallback(() => {
    setIsLoading(true);
    setError(false);
    fetchAuditLogPage(tenantId, {
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
  }, [tenantId, category, from, to]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchAuditLogPage(tenantId, {
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
    return logs.filter((log) => log.userEmail.toLowerCase().includes(term));
  }, [logs, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-neutral-700" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-neutral-900">{t("auditLog.title")}</h1>
      </div>
      <p className="text-sm text-neutral-500">{t("auditLog.subtitle")}</p>

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
          <AuditLogTable logs={visibleLogs} isLoading={isLoading} onSelect={setSelectedLog} />

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
