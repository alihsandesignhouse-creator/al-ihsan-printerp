"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Building2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { subscribeAllBranches } from "@/lib/firebase/branches";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { BranchFormModal } from "@/components/tenant/settings/branch-form-modal";
import { ToggleBranchActiveDialog } from "@/components/tenant/settings/toggle-branch-active-dialog";
import type { Branch } from "@/lib/types/dashboard";

interface BranchManagementProps {
  tenantId: string;
}

export function BranchManagement({ tenantId }: BranchManagementProps) {
  const t = useTranslations();
  const handleFirestoreError = useFirestoreErrorHandler();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [formTarget, setFormTarget] = useState<Branch | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<Branch | null>(null);

  useEffect(() => {
    const unsub = subscribeAllBranches(tenantId, setBranches, handleFirestoreError(() => setBranches([])));
    return unsub;
  }, [tenantId, handleFirestoreError]);

  function openCreate() {
    setFormTarget(null);
    setFormOpen(true);
  }

  function openEdit(branch: Branch) {
    setFormTarget(branch);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{t("settings.branch.subtitle")}</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("settings.branch.add")}
        </Button>
      </div>

      {branches === null ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          {t("settings.branch.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{b.name}</p>
                <p className="truncate text-xs text-neutral-500">{b.address}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  b.isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {b.isActive ? t("settings.branch.active") : t("settings.branch.inactive")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEdit(b)}
                title={t("common.edit")}
                aria-label={t("common.edit")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setToggleTarget(b)}
                title={b.isActive ? t("settings.branch.deactivate") : t("settings.branch.activate")}
                aria-label={b.isActive ? t("settings.branch.deactivate") : t("settings.branch.activate")}
              >
                <Power className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <BranchFormModal
        tenantId={tenantId}
        open={formOpen}
        onOpenChange={setFormOpen}
        branch={formTarget}
      />
      <ToggleBranchActiveDialog
        tenantId={tenantId}
        branch={toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
      />
    </div>
  );
}
