"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PlusCircle, Search } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeStaffMembers, getTenantPlanInfo } from "@/lib/firebase/users";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { StaffListTable } from "@/components/tenant/users/staff-list-table";
import { StaffFormModal } from "@/components/tenant/users/staff-form-modal";
import { ToggleStaffActiveDialog } from "@/components/tenant/users/toggle-staff-active-dialog";
import { StaffLimitBanner } from "@/components/tenant/users/staff-limit-banner";
import type { StaffMember } from "@/lib/types/user";
import type { Branch } from "@/lib/types/dashboard";
import type { PlanId } from "@/lib/types/tenant";

export default function UsersPage() {
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;

  // Only tenant_admin can access this page; middleware + layout guard it,
  // but we also render null here defensively.
  if (user?.claims.role !== "tenant_admin") return null;

  return tenantId ? <UsersPageContent tenantId={tenantId} /> : null;
}

function UsersPageContent({ tenantId }: { tenantId: string }) {
  const t = useTranslations();
  const handleFirestoreError = useFirestoreErrorHandler();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [planId, setPlanId] = useState<PlanId>("basic");
  const [isTrial, setIsTrial] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string | "all">("all");
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [toggleTarget, setToggleTarget] = useState<StaffMember | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);

  useEffect(() => {
    const unsubBranches = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    getTenantPlanInfo(tenantId)
      .then(({ planId: p, isTrial: tr }) => {
        setPlanId(p);
        setIsTrial(tr);
      })
      .catch(handleFirestoreError());
    return () => unsubBranches();
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeStaffMembers(
      tenantId,
      branchFilter,
      (data) => {
        setStaff(data);
        setIsLoading(false);
      },
      handleFirestoreError(() => setIsLoading(false))
    );
    return () => unsub();
  }, [tenantId, branchFilter, handleFirestoreError]);

  const activeCount = useMemo(
    () => staff.filter((s) => s.isActive).length,
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (!showInactive && !s.isActive) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term)
      );
    });
  }, [staff, search, showInactive]);

  function openCreate() {
    setEditingStaff(null);
    setFormOpen(true);
  }

  function openEdit(member: StaffMember) {
    setEditingStaff(member);
    setFormOpen(true);
  }

  function openToggleActive(member: StaffMember) {
    setToggleTarget(member);
    setToggleOpen(true);
  }

  // refresh is a no-op because we use onSnapshot — the UI updates automatically
  function handleSaved() {/* snapshot listener auto-refreshes */}
  function handleToggleDone() {/* snapshot listener auto-refreshes */}

  const fieldClass =
    "h-10 rounded-lg border border-neutral-200 px-3 text-sm outline-none transition-colors focus:border-brand-primary focus:ring-1 focus:ring-brand-primary";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">
          {t("users.pageTitle")}
        </h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          {t("users.addStaff")}
        </button>
      </div>

      {/* Staff limit banner */}
      <StaffLimitBanner
        planId={planId}
        isTrial={isTrial}
        activeCount={activeCount}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("users.searchPlaceholder")}
            className={`${fieldClass} w-full pl-9`}
          />
        </div>

        {/* Branch filter */}
        {branches.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className={fieldClass}
          >
            <option value="all">{t("common.allBranches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        {/* Show inactive toggle */}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 accent-brand-primary"
          />
          {t("users.showInactive")}
        </label>
      </div>

      {/* Staff table */}
      <StaffListTable
        staff={filteredStaff}
        branches={branches}
        isLoading={isLoading}
        onEdit={openEdit}
        onToggleActive={openToggleActive}
      />

      {/* Create / Edit modal */}
      <StaffFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        branches={branches}
        editingStaff={editingStaff}
        onSaved={handleSaved}
      />

      {/* Toggle active confirm dialog */}
      <ToggleStaffActiveDialog
        open={toggleOpen}
        onOpenChange={setToggleOpen}
        staff={toggleTarget}
        onDone={handleToggleDone}
      />
    </div>
  );
}
