'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  Eye,
  Pencil,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  Trash2,
} from 'lucide-react';
import type { Tenant } from '@/lib/types/tenant';

interface TenantActionsMenuProps {
  tenant: Tenant;
  onActivate: (tenant: Tenant) => void;
  onEdit: (tenant: Tenant) => void;
  onSuspend: (tenant: Tenant) => void;
  onReactivate: (tenant: Tenant) => void;
  onDelete: (tenant: Tenant) => void;
}

export function TenantActionsMenu({
  tenant,
  onActivate,
  onEdit,
  onSuspend,
  onReactivate,
  onDelete,
}: TenantActionsMenuProps) {
  const t = useTranslations('sa.tenants.actions');
  const router = useRouter();

  const isTrial = tenant.subscriptionStatus === 'trial';
  const isSuspended = tenant.subscriptionStatus === 'suspended';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-500 hover:text-neutral-800"
          aria-label={t('actionsFor', { name: tenant.name })}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Details */}
        <DropdownMenuItem
          onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
          className="cursor-pointer"
        >
          <Eye className="w-4 h-4 mr-2 text-neutral-500" />
          {t('details')}
        </DropdownMenuItem>

        {/* Edit */}
        <DropdownMenuItem
          onClick={() => onEdit(tenant)}
          className="cursor-pointer"
        >
          <Pencil className="w-4 h-4 mr-2 text-neutral-500" />
          {t('edit')}
        </DropdownMenuItem>

        {/* Activate — only for trial or expired */}
        {(isTrial || tenant.subscriptionStatus === 'expired') && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onActivate(tenant)}
              className="cursor-pointer text-green-700 focus:text-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('activate')}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Suspend / Reactivate */}
        {isSuspended ? (
          <DropdownMenuItem
            onClick={() => onReactivate(tenant)}
            className="cursor-pointer text-blue-700 focus:text-blue-700"
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            {t('reactivate')}
          </DropdownMenuItem>
        ) : (
          tenant.subscriptionStatus === 'active' && (
            <DropdownMenuItem
              onClick={() => onSuspend(tenant)}
              className="cursor-pointer text-amber-700 focus:text-amber-700"
            >
              <PauseCircle className="w-4 h-4 mr-2" />
              {t('suspend')}
            </DropdownMenuItem>
          )
        )}

        {/* Permanent delete — always available, deliberately separated
            with its own visual weight so it never gets clicked by
            accident in place of Suspend (session 9, ১৮ আগস্ট ২০২৬) */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(tenant)}
          className="cursor-pointer text-status-danger focus:text-status-danger"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
