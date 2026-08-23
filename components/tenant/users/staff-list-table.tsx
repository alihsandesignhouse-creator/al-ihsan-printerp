"use client";

import { useTranslations } from "next-intl";
import { Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffStatusBadge } from "./staff-status-badge";
import { RoleBadge } from "./role-badge";
import type { StaffMember } from "@/lib/types/user";

interface StaffListTableProps {
  staff: StaffMember[];
  branches: { id: string; name: string }[];
  isLoading: boolean;
  onEdit: (staff: StaffMember) => void;
  onToggleActive: (staff: StaffMember) => void;
}

export function StaffListTable({
  staff,
  branches,
  isLoading,
  onEdit,
  onToggleActive,
}: StaffListTableProps) {
  const t = useTranslations();

  const branchNameMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
        <Users className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-400">{t("users.noStaffFound")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">{t("users.table.name")}</th>
              <th className="px-4 py-2.5">{t("users.table.email")}</th>
              <th className="px-4 py-2.5">{t("users.table.role")}</th>
              <th className="px-4 py-2.5">{t("users.table.branch")}</th>
              <th className="px-4 py-2.5">{t("users.table.commission")}</th>
              <th className="px-4 py-2.5">{t("users.table.status")}</th>
              <th className="px-4 py-2.5 text-right">{t("users.table.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {staff.map((member) => (
              <tr
                key={member.id}
                className={
                  member.isActive ? "hover:bg-neutral-50" : "bg-neutral-50/60 hover:bg-neutral-50"
                }
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-neutral-900">{member.name}</span>
                </td>
                <td className="px-4 py-3 text-neutral-500">{member.email}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={member.role} />
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {member.branchId
                    ? (branchNameMap[member.branchId] ?? member.branchId)
                    : <span className="text-neutral-300">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-neutral-600">
                  {member.role === "commission_staff"
                    ? `${member.commissionRate}%`
                    : <span className="text-neutral-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <StaffStatusBadge isActive={member.isActive} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(member)}
                      title={t("common.edit")}
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>

                    <button
                      type="button"
                      onClick={() => onToggleActive(member)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        member.isActive
                          ? "border-neutral-200 text-neutral-600 hover:border-status-danger hover:text-status-danger"
                          : "border-neutral-200 text-neutral-600 hover:border-green-500 hover:text-green-600"
                      }`}
                    >
                      {member.isActive
                        ? t("users.action.deactivate")
                        : t("users.action.activate")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
