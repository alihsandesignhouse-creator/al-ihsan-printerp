"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Settings2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscribeTenant, computeEffectiveFeatures } from "@/lib/firebase/tenants";
import { useFirestoreErrorHandler } from "@/lib/hooks/use-firestore-error-handler";
import { GeneralSettingsForm } from "@/components/tenant/settings/general-settings-form";
import { BusinessSettingsForm } from "@/components/tenant/settings/business-settings-form";
import { NotificationSettingsForm } from "@/components/tenant/settings/notification-settings-form";
import { BranchManagement } from "@/components/tenant/settings/branch-management";
import { LockedFeatureNotice } from "@/components/shared/locked-feature-notice";
import { DEFAULT_NOTIFICATION_TEMPLATES } from "@/lib/types/tenant";
import type { Tenant } from "@/lib/types/tenant";

export default function TenantSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.claims.tenantId ?? null;

  // বাগ-ফিক্স (২০ আগস্ট ২০২৬ কোডবেস-অডিট): sidebar.tsx-এ "Settings" লিংক
  // আগে থেকেই roles: ["tenant_admin"]-এ সীমাবদ্ধ, এবং users/page.tsx ও
  // audit-log/page.tsx দুটোতেই একই defensive guard আছে ("middleware +
  // layout guard it, but we also render null here defensively") — কিন্তু
  // এই পেজে সেই একই guard ভুলে বাদ পড়ে গিয়েছিল। middleware ইচ্ছাকৃতভাবে
  // per-path role-check করে না (role-based UI page/component level-এ
  // enforce হওয়ার কথা — middleware.ts-এর কমেন্ট দ্রষ্টব্য), তাই এই গার্ড
  // ছাড়া branch_manager/staff সরাসরি URL দিয়ে গেলে পুরো সেটিংস ফর্ম
  // (নাম/ঠিকানা/কমিশন-হার ইত্যাদি) দেখতে পেতেন — যদিও Firestore rules
  // (tenants/{tenantId}-এর allow update: isTenantAdmin() only) আসল
  // ডেটা-লেভেলে সুরক্ষিত ছিল, তাই "Save" চাপলে কনফিউজিং permission-denied
  // এরর পেতেন, কোনো ডেটা আসলে ফাঁস/পরিবর্তন হতো না। এখন users/page.tsx-এর
  // সাথে হুবহু সামঞ্জস্যপূর্ণ wrapper+content split প্যাটার্নে ফিক্স করা
  // হলো — নিচের hook-ভারী কম্পোনেন্টের আগে গার্ড বসালে React-এর Rules of
  // Hooks ভাঙত (early return-এর পরে useState/useEffect কল করা যায় না),
  // তাই আলাদা করে TenantSettingsPageContent কম্পোনেন্টে সরানো হয়েছে।
  if (user?.claims.role !== "tenant_admin") return null;

  return tenantId ? <TenantSettingsPageContent tenantId={tenantId} /> : null;
}

function TenantSettingsPageContent({ tenantId }: { tenantId: string }) {
  const t = useTranslations();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loaded, setLoaded] = useState(false);
  const handleFirestoreError = useFirestoreErrorHandler();

  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTenant(
      tenantId,
      (data) => {
        setTenant(data);
        setLoaded(true);
      },
      handleFirestoreError(() => setLoaded(true))
    );
    return unsub;
  }, [tenantId, handleFirestoreError]);

  if (!loaded) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!tenant || !tenantId) {
    return <p className="p-6 text-sm text-status-danger">{t("settings.loadFailed")}</p>;
  }

  const features = computeEffectiveFeatures(tenant.planId, tenant.featureOverrides, tenant.planFeatures);
  // Older tenant docs created before this module may not have these fields yet.
  const tenantSafe: Tenant = {
    ...tenant,
    invoiceFooterMessage: tenant.invoiceFooterMessage ?? "",
    notificationTemplates: tenant.notificationTemplates ?? DEFAULT_NOTIFICATION_TEMPLATES,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <Settings2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{t("settings.title")}</h1>
          <p className="text-sm text-neutral-500">{t("settings.subtitle")}</p>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t("settings.tabs.general")}</TabsTrigger>
          <TabsTrigger value="business">{t("settings.tabs.business")}</TabsTrigger>
          <TabsTrigger value="notification">{t("settings.tabs.notification")}</TabsTrigger>
          <TabsTrigger value="branch">{t("settings.tabs.branch")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="rounded-xl border border-neutral-200 bg-white p-5">
          <GeneralSettingsForm tenant={tenantSafe} />
        </TabsContent>

        <TabsContent value="business" className="rounded-xl border border-neutral-200 bg-white p-5">
          <BusinessSettingsForm tenant={tenantSafe} />
        </TabsContent>

        <TabsContent value="notification" className="rounded-xl border border-neutral-200 bg-white p-5">
          {features.smsNotifications || features.emailNotifications ? (
            <NotificationSettingsForm tenant={tenantSafe} />
          ) : (
            <LockedFeatureNotice messageKey="settings.locked.notification" />
          )}
        </TabsContent>

        <TabsContent value="branch" className="rounded-xl border border-neutral-200 bg-white p-5">
          {/*
            বাগ-ফিক্স (১৫ আগস্ট ২০২৬, শূন্য-শাখা / একক-মালিক): আগে এই ট্যাব
            সম্পূর্ণভাবে features.multiBranch-এর পেছনে লক ছিল, তাই
            Basic-প্ল্যানের (multiBranch: false) টেন্যান্টরা তাদের
            সাইনআপের সময় স্বয়ংক্রিয়ভাবে তৈরি হওয়া একমাত্র "প্রধান শাখা"-র
            নাম/ঠিকানাও কখনো দেখতে বা এডিট করতে পারতেন না। এখন ট্যাবটা সব
            প্ল্যানের জন্য খোলা — নতুন শাখা "যোগ করার" ক্ষমতা তবু কার্যকরভাবে
            লকই থাকে, কারণ app/api/branches/create ইতিমধ্যে
            lib/server/branch-helpers.ts-এর getBranchLimit() দিয়ে প্রতি
            প্ল্যানের সর্বোচ্চ শাখা সংখ্যা (basic ১টি) কঠোরভাবে enforce করে —
            ঠিক staff-form-modal.tsx-এ staff সীমার জন্য যেমন হয়। তাই Basic
            টেন্যান্ট দ্বিতীয় শাখা তৈরি করতে চাইলে branch-form-modal.tsx-এ
            "আপনার প্যাকেজের শাখা সীমা শেষ হয়ে গেছে" এরর দেখবেন — আলাদা করে
            "Add" বাটন লুকানোর দরকার নেই। এটা পুরনো/ইতিমধ্যে-আক্রান্ত
            শূন্য-শাখা টেন্যান্টদেরও কোনো migration script ছাড়াই এখান থেকে
            নিজেদের প্রথম শাখা তৈরি করে স্ব-নিরাময়ের সুযোগ দেয়।
          */}
          <BranchManagement tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
