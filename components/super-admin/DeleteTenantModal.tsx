'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { deleteTenantPermanently, DeleteTenantError } from '@/lib/firebase/tenants';
import type { Tenant } from '@/lib/types/tenant';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface DeleteTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onSuccess: () => void;
}

/**
 * সেশন ৯ (১৮ আগস্ট ২০২৬) — সুপার এডমিন থেকে টেন্যান্ট স্থায়ীভাবে হার্ড-ডিলিট।
 * ConfirmDialog.tsx (generic AlertDialog, ফ্রি-টেক্সট ইনপুট নেয় না)
 * ইচ্ছাকৃতভাবে ব্যবহার করা হয়নি — এই কাজটা এতটাই ফেরত-অযোগ্য যে শুধু
 * "নিশ্চিত?" বাটনের বদলে টেন্যান্টের নাম হুবহু টাইপ করিয়ে নেওয়া হয় (type-
 * to-confirm), তাই আলাদা Dialog-ভিত্তিক কম্পোনেন্ট। `preventOutsideClose`
 * ব্যবহার করা হয়েছে যাতে ভুলবশত বাইরে ক্লিকে বন্ধ না হয়ে যায়।
 */
export function DeleteTenantModal({
  open,
  onOpenChange,
  tenant,
  onSuccess,
}: DeleteTenantModalProps) {
  const t = useTranslations('sa.deleteTenant');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setConfirmText('');
  }, [open]);

  if (!tenant) return null;

  const nameMatches = confirmText.trim() === tenant.name;

  const handleConfirm = async () => {
    if (!nameMatches || loading) return;
    setLoading(true);
    try {
      await deleteTenantPermanently(tenant.id, confirmText.trim());
      toast.success(t('success'));
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof DeleteTenantError ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <DialogContent preventOutsideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-status-danger">
            <AlertTriangle className="w-5 h-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description', { name: tenant.name })}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium">
          {t('warning')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="delete-tenant-confirm">
            {t('typeToConfirmLabel', { name: tenant.name })}
          </Label>
          <Input
            id="delete-tenant-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('typeToConfirmPlaceholder')}
            disabled={loading}
            autoComplete="off"
            className="border-neutral-200 focus-visible:ring-status-danger"
          />
          {confirmText.length > 0 && !nameMatches && (
            <p className="text-xs text-red-600">{t('mismatchHint')}</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!nameMatches || loading}
            className="bg-status-danger hover:bg-status-danger/90 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? t('deleting') : t('confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
