"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Save, FolderPlus } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeTenant } from "@/lib/firebase/tenants";
import { subscribeBranches } from "@/lib/firebase/dashboard";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import {
  subscribeCostTemplates,
  subscribeCostCalculations,
  createCostTemplate,
  saveCostCalculation,
} from "@/lib/firebase/cost-calculator";
import { CostCalculatorForm } from "@/components/tenant/costing/cost-calculator-form";
import { SaveAsDialog } from "@/components/tenant/costing/save-as-dialog";
import { TemplatePanel } from "@/components/tenant/costing/template-panel";
import { PresetPanel } from "@/components/tenant/costing/preset-panel";
import { CalculationHistory } from "@/components/tenant/costing/calculation-history";
import { LockedFeatureNotice } from "@/components/shared/locked-feature-notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tenant } from "@/lib/types/tenant";
import type { Branch } from "@/lib/types/dashboard";
import type { CostCategoryRow, CostTemplate, CostCalculation } from "@/lib/types/cost-calculator";
import type { CostCalculatorPreset } from "@/lib/data/cost-calculator-presets";

function newRow(): CostCategoryRow {
  return { id: crypto.randomUUID(), name: "", quantity: 0, unitPrice: 0, totalOverride: null };
}

export default function CostingPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.claims.role;

  // বাগ-ফিক্স (২০ আগস্ট ২০২৬ কোডবেস-অডিট): sidebar.tsx-এ "nav.costing"
  // লিংক roles: ["tenant_admin", "branch_manager"]-এ সীমাবদ্ধ, কিন্তু এই
  // পেজে আগে কোনো matching guard ছিল না — settings/page.tsx-এ ঠিক একই
  // প্যাটার্নের বাগ পাওয়া গিয়েছিল (দেখুন সেই ফাইলের কমেন্ট)। এখানে ঝুঁকিটা
  // আসলে বেশি: zakat_years-এর মতো Firestore rules read-ও role-restrict
  // করে না — cost_templates/cost_calculations-এর rules শুধু
  // canAccessBranch() চেক করে, role() চেক করে না (দেখুন firestore.rules)।
  // তাই এই guard ছাড়া commission_staff/regular_staff সরাসরি URL দিয়ে
  // গেলে শুধু ফাঁকা পেজ না, প্রকৃত উৎপাদন-খরচ/মুনাফার হিসাবই দেখতে
  // পেতেন — users/page.tsx-এর সাথে সামঞ্জস্যপূর্ণ wrapper+content split
  // প্যাটার্নে ফিক্স করা হলো (early return-এর পরে hook কল করলে React-এর
  // Rules of Hooks ভাঙে, তাই আলাদা কম্পোনেন্টে সরানো)।
  if (role !== "tenant_admin" && role !== "branch_manager") return null;

  return <CostingPageContent />;
}

function CostingPageContent() {
  const t = useTranslations();
  const locale = useLocale() as "bn" | "en";
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;
  const handleFirestoreError = useFirestoreErrorHandler();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoaded, setTenantLoaded] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");

  const [rows, setRows] = useState<CostCategoryRow[]>([newRow()]);
  const [pieceQuantity, setPieceQuantity] = useState(0);
  const [profitMarginPercent, setProfitMarginPercent] = useState(0);
  const [activeCalculationName, setActiveCalculationName] = useState<string | null>(null);

  const [templates, setTemplates] = useState<CostTemplate[]>([]);
  const [calculations, setCalculations] = useState<CostCalculation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [calcDialogOpen, setCalcDialogOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (data) => {
        setTenant(data);
        setTenantLoaded(true);
      },
      handleFirestoreError(() => setTenantLoaded(true))
    );
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeBranches(tenantId, setBranches, handleFirestoreError());
    return unsub;
  }, [tenantId, handleFirestoreError]);

  useEffect(() => {
    if (!branchId && branches.length > 0) {
      setBranchId(branches[0]!.id);
    }
  }, [branches, branchId]);

  useEffect(() => {
    if (!tenantId || !branchId) return;
    const unsub = subscribeCostTemplates(tenantId, branchId, setTemplates, handleFirestoreError());
    return unsub;
  }, [tenantId, branchId, handleFirestoreError]);

  useEffect(() => {
    if (!tenantId || !branchId) return;
    setHistoryLoading(true);
    const unsub = subscribeCostCalculations(
      tenantId,
      branchId,
      (data) => {
        setCalculations(data);
        setHistoryLoading(false);
      },
      handleFirestoreError(() => setHistoryLoading(false))
    );
    return unsub;
  }, [tenantId, branchId, handleFirestoreError]);

  const features = useMemo(() => {
    if (!tenant) return null;
    return { ...tenant.planFeatures, ...tenant.featureOverrides };
  }, [tenant]);

  function resetCalculator() {
    setRows([newRow()]);
    setPieceQuantity(0);
    setProfitMarginPercent(0);
    setActiveCalculationName(null);
  }

  function loadTemplate(template: CostTemplate) {
    const sorted = [...template.categories].sort((a, b) => a.order - b.order);
    setRows(
      sorted.length > 0
        ? sorted.map((c) => ({ id: crypto.randomUUID(), name: c.name, quantity: 0, unitPrice: 0, totalOverride: null }))
        : [newRow()]
    );
    setActiveCalculationName(null);
  }

  /**
   * বিল্ট-ইন কুইক-স্টার্ট প্রিসেট লোড (audit #৫) — loadTemplate()-এর সাথে
   * হুবহু একই আচরণ (নাম বসে, পরিমাণ/মূল্য খালি থাকে), শুধু উৎস Firestore
   * টেমপ্লেট না হয়ে স্থানীয় ধ্রুবক ও locale অনুযায়ী bn/en থেকে বেছে নেওয়া।
   */
  function loadPreset(preset: CostCalculatorPreset) {
    setRows(
      preset.categoryNames.map((c) => ({
        id: crypto.randomUUID(),
        name: c[locale] ?? c.bn,
        quantity: 0,
        unitPrice: 0,
        totalOverride: null,
      }))
    );
    setActiveCalculationName(null);
  }

  function loadCalculation(calc: CostCalculation) {
    setRows(
      calc.categories.map((c) => ({
        id: crypto.randomUUID(),
        name: c.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        totalOverride: null,
      }))
    );
    setPieceQuantity(calc.pieceQuantity);
    setProfitMarginPercent(calc.profitMarginPercent);
    setActiveCalculationName(calc.name);
  }

  const validRows = rows.filter((r) => r.name.trim().length > 0);

  // বাগ-ফিক্স (১৫ আগস্ট ২০২৬, শূন্য-শাখা / একক-মালিক): আগে এই দুই ফাংশনে
  // "if (!tenantId || !user || !branchId) return;" ছিল — branchId খালি
  // থাকলে ফাংশনটা নিঃশব্দে কিছুই না করেই রিটার্ন করত (কোনো এরর থ্রো
  // করত না), অথচ SaveAsDialog-এর onSave() কল সফলভাবে resolve হয়ে যেত
  // বলে ধরে নিয়ে "সংরক্ষিত হয়েছে" সাফল্য টোস্ট দেখাত — ব্যবহারকারী
  // ভাবতেন সেভ হয়েছে, বাস্তবে কিছুই Firestore-এ লেখা হয়নি। এখন branchId
  // না থাকলে স্পষ্টভাবে throw করা হয়, যাতে SaveAsDialog-এর catch ব্লক
  // আসল ব্যর্থতার টোস্ট দেখায়। signup route এখন সবসময় একটা ডিফল্ট শাখা
  // তৈরি করে বলে এই অবস্থা বাস্তবে ঘটার কথা নয় — এটা শুধু defense-in-depth।
  async function handleSaveTemplate(name: string) {
    if (!tenantId || !user) return;
    if (!branchId) throw new Error("costing.branchRequiredError");
    if (validRows.length === 0) throw new Error("costing.noCategoriesToSave");
    await createCostTemplate(tenantId, user.uid, user.displayName ?? user.email ?? "", {
      name,
      branchId,
      categories: validRows.map((r, index) => ({ name: r.name, order: index })),
    });
  }

  async function handleSaveCalculation(name: string) {
    if (!tenantId || !user) return;
    if (!branchId) throw new Error("costing.branchRequiredError");
    if (validRows.length === 0) throw new Error("costing.noCategoriesToSave");
    await saveCostCalculation(tenantId, user.uid, user.displayName ?? user.email ?? "", {
      name,
      branchId,
      categories: validRows,
      pieceQuantity,
      profitMarginPercent,
    });
  }

  if (!tenantId) return null;

  if (!tenantLoaded) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!features?.costCalculator) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-neutral-900">{t("costing.pageTitle")}</h1>
        <LockedFeatureNotice messageKey="costing.locked" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{t("costing.pageTitle")}</h1>
          {activeCalculationName && (
            <p className="text-xs text-neutral-500">
              {t("costing.editingCalculation")}: {activeCalculationName}
            </p>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={resetCalculator}>
          {t("costing.newCalculation")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CostCalculatorForm
            branches={branches}
            branchId={branchId}
            onBranchChange={setBranchId}
            rows={rows}
            onRowsChange={setRows}
            pieceQuantity={pieceQuantity}
            onPieceQuantityChange={setPieceQuantity}
            profitMarginPercent={profitMarginPercent}
            onProfitMarginChange={setProfitMarginPercent}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplateDialogOpen(true)}
              disabled={validRows.length === 0}
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              {t("costing.saveAsTemplate")}
            </Button>
            <Button type="button" onClick={() => setCalcDialogOpen(true)} disabled={validRows.length === 0}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {t("costing.saveCalculation")}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <PresetPanel onLoadPreset={loadPreset} />
          <TemplatePanel tenantId={tenantId} userId={user!.uid} templates={templates} onLoad={loadTemplate} />
          <CalculationHistory
            tenantId={tenantId}
            userId={user!.uid}
            calculations={calculations}
            isLoading={historyLoading}
            onLoad={loadCalculation}
          />
        </div>
      </div>

      <SaveAsDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        titleKey="costing.saveAsTemplateTitle"
        labelKey="costing.templateName"
        placeholderKey="costing.templateNamePlaceholder"
        successMessageKey="costing.templateSaved"
        failureMessageKey="costing.saveFailed"
        onSave={handleSaveTemplate}
      />

      <SaveAsDialog
        open={calcDialogOpen}
        onOpenChange={setCalcDialogOpen}
        titleKey="costing.saveCalculationTitle"
        labelKey="costing.calculationName"
        placeholderKey="costing.calculationNamePlaceholder"
        successMessageKey="costing.calculationSaved"
        failureMessageKey="costing.saveFailed"
        onSave={handleSaveCalculation}
      />
    </div>
  );
}
