"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { auditActionMessageKey, resolveAuditCategory } from "@/lib/types/audit";
import type { AuditLog } from "@/lib/types/audit";

interface AuditLogDetailDialogProps {
  log: AuditLog | null;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDetailDialog({ log, onOpenChange }: AuditLogDetailDialogProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <Dialog open={log !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        {log && (
          <>
            <DialogHeader>
              <DialogTitle>{t(auditActionMessageKey(log.action))}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-neutral-500">{t("auditLog.columns.time")}</p>
                  <p className="font-medium text-neutral-900">
                    {log.createdAt.toDate().toLocaleString(locale === "bn" ? "bn-BD" : "en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">{t("auditLog.columns.user")}</p>
                  <p className="truncate font-medium text-neutral-900">{log.userEmail || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">{t("auditLog.columns.category")}</p>
                  <p className="font-medium text-neutral-900">
                    {t(`auditLog.category.${resolveAuditCategory(log.action)}`)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">{t("auditLog.columns.resourceId")}</p>
                  <p className="truncate font-mono text-xs text-neutral-700">{log.resourceId || "—"}</p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs text-neutral-500">{t("auditLog.columns.details")}</p>
                {Object.keys(log.changes ?? {}).length === 0 ? (
                  <p className="text-neutral-400">{t("auditLog.noDetails")}</p>
                ) : (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-50 p-3 font-mono text-xs text-neutral-700">
                    {JSON.stringify(log.changes, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
