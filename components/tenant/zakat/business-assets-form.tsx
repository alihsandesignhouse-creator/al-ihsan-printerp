"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AmountListEditor } from "@/components/tenant/zakat/amount-list-editor";
import { fetchBusinessAssetsSnapshot, updateZakatYearAssets } from "@/lib/firebase/zakat";
import { formatTaka } from "@/lib/utils/calculations";
import type { ZakatYear, ZakatAssetLine, BusinessAssetsSnapshot } from "@/lib/types/zakat";

interface BusinessAssetsFormProps {
  tenantId: string;
  year: ZakatYear;
  onSaved: () => void;
}

/**
 * blueprint ZK-01: "ভাগ ১: ব্যবসায়িক সম্পদ (স্বয়ংক্রিয়) ... ভাগ ২: ব্যবসার
 * বাইরের সম্পদ (ম্যানুয়াল) ... বাদযোগ্য দেনা"। স্টকের মূল্য অন্তর্ভুক্ত নেই
 * (দেখুন lib/firebase/zakat.ts মন্তব্য) — ব্যবহারকারী চাইলে ম্যানুয়ালি
 * businessAssets-এ যোগ করে নিতে পারেন।
 */
export function BusinessAssetsForm({ tenantId, year, onSaved }: BusinessAssetsFormProps) {
  const t = useTranslations();

  const [businessAssets, setBusinessAssets] = useState(year.businessAssets);
  const [nisabAmount, setNisabAmount] = useState(year.nisabAmount);
  const [externalAssets, setExternalAssets] = useState<ZakatAssetLine[]>(year.externalAssets);
  const [liabilities, setLiabilities] = useState<ZakatAssetLine[]>(year.liabilities);

  const [snapshot, setSnapshot] = useState<BusinessAssetsSnapshot | null>(null);
  const [isFetchingSnapshot, setIsFetchingSnapshot] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBusinessAssets(year.businessAssets);
    setNisabAmount(year.nisabAmount);
    setExternalAssets(year.externalAssets);
    setLiabilities(year.liabilities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year.id]);

  async function handleFetchSnapshot() {
    setIsFetchingSnapshot(true);
    try {
      const result = await fetchBusinessAssetsSnapshot(tenantId);
      setSnapshot(result);
    } catch {
      toast.error(t("zakat.snapshotFailed"));
    } finally {
      setIsFetchingSnapshot(false);
    }
  }

  function applySnapshot() {
    if (!snapshot) return;
    setBusinessAssets(snapshot.suggestedTotal);
    setSnapshot(null);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateZakatYearAssets(tenantId, year.id, { businessAssets, nisabAmount, externalAssets, liabilities });
      toast.success(t("zakat.assetsSaved"));
      onSaved();
    } catch {
      toast.error(t("zakat.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{t("zakat.businessAssetsTitle")}</h2>
        <Button type="button" variant="outline" size="sm" onClick={handleFetchSnapshot} disabled={isFetchingSnapshot}>
          {isFetchingSnapshot ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          {t("zakat.fetchLatestData")}
        </Button>
      </div>

      {snapshot && (
        <div className="rounded-lg border border-dashed border-brand-primary/40 bg-blue-50/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-600">{t("zakat.netCashPosition")}</span>
            <span className="font-mono text-neutral-900">{formatTaka(snapshot.netCashPosition)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-neutral-600">{t("zakat.totalReceivables")}</span>
            <span className="font-mono text-neutral-900">{formatTaka(snapshot.totalReceivables)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-blue-100 pt-1 font-medium">
            <span className="text-neutral-700">{t("zakat.suggestedTotal")}</span>
            <span className="font-mono text-brand-primary">{formatTaka(snapshot.suggestedTotal)}</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">{t("zakat.snapshotNote")}</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSnapshot(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={applySnapshot}>
              {t("zakat.useThisValue")}
            </Button>
          </div>
        </div>
      )}

      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.businessAssets")}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={businessAssets}
          onChange={(e) => setBusinessAssets(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>

      <AmountListEditor
        title={t("zakat.externalAssets")}
        addLabel={t("zakat.addExternalAsset")}
        namePlaceholder={t("zakat.assetNamePlaceholder")}
        descriptionPlaceholder={t("zakat.descriptionPlaceholder")}
        emptyLabel={t("zakat.noExternalAssets")}
        lines={externalAssets}
        onChange={setExternalAssets}
      />

      <AmountListEditor
        title={t("zakat.liabilities")}
        addLabel={t("zakat.addLiability")}
        namePlaceholder={t("zakat.liabilityNamePlaceholder")}
        descriptionPlaceholder={t("zakat.descriptionPlaceholder")}
        emptyLabel={t("zakat.noLiabilities")}
        lines={liabilities}
        onChange={setLiabilities}
      />

      <div>
        <Label className="mb-1 block text-sm font-medium text-neutral-700">{t("zakat.nisabAmount")}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={nisabAmount}
          onChange={(e) => setNisabAmount(Math.max(0, Number(e.target.value) || 0))}
        />
        <p className="mt-1 text-xs text-neutral-400">{t("zakat.nisabHint")}</p>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {isSaving ? t("common.loading") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
