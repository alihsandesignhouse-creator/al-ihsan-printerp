"use client";

import { useTranslations } from "next-intl";
import { Plus, X, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AttributeGroup, AttributeOption } from "@/lib/types/order";

interface ItemAttributeGroupsEditorProps {
  groups: AttributeGroup[];
  onChange: (groups: AttributeGroup[]) => void;
  errorText?: string | null;
}

function newId(): string {
  return crypto.randomUUID();
}

function emptyOption(): AttributeOption {
  return { id: newId(), label: "", priceAdjustment: 0 };
}

function emptyGroup(): AttributeGroup {
  return { id: newId(), name: "", options: [emptyOption()] };
}

/**
 * Audit item #৪, ধাপ ১: আইটেম মাস্টার ফর্মে "অ্যাট্রিবিউট গ্রুপ" (সাইজ,
 * কালার, লেমিনেশন — যেকোনো নাম) dynamic add/remove এডিটর। কস্ট
 * ক্যালকুলেটরের dynamic-category UI-এর সাথে ইচ্ছাকৃতভাবে একই ভিজ্যুয়াল
 * ভাষা (বর্ডারড কার্ড, ইনলাইন [X] বাটন)। সম্পূর্ণ ঐচ্ছিক — খালি রাখলে
 * আইটেমের কোনো ভ্যারিয়েন্ট থাকবে না, বিদ্যমান আচরণ অপরিবর্তিত।
 *
 * অর্ডার ফর্মে ভ্যারিয়েন্ট বাছাই UI (ধাপ ২) ও ডেলিভারি চালানে প্রদর্শন
 * (ধাপ ৩) পরবর্তী সেশনের স্কোপ — এই ধাপে শুধু আইটেম মাস্টারে ডেটা
 * তৈরি/সম্পাদনার সুবিধা যোগ হয়েছে।
 */
export function ItemAttributeGroupsEditor({ groups, onChange, errorText }: ItemAttributeGroupsEditorProps) {
  const t = useTranslations();

  function addGroup() {
    onChange([...groups, emptyGroup()]);
  }

  function removeGroup(groupId: string) {
    onChange(groups.filter((g) => g.id !== groupId));
  }

  function updateGroupName(groupId: string, name: string) {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, name } : g)));
  }

  function addOption(groupId: string) {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, options: [...g.options, emptyOption()] } : g)));
  }

  function removeOption(groupId: string, optionId: string) {
    onChange(
      groups.map((g) => (g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g))
    );
  }

  function updateOption(groupId: string, optionId: string, patch: Partial<AttributeOption>) {
    onChange(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
          : g
      )
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="text-sm font-medium text-neutral-800">{t("itemMaster.attributeGroups")}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addGroup}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("itemMaster.addGroup")}
        </Button>
      </div>
      <p className="text-xs text-neutral-400">{t("itemMaster.attributeGroupsNote")}</p>

      {groups.length === 0 ? (
        <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-400">
          {t("itemMaster.noAttributeGroups")}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={group.name}
                  onChange={(e) => updateGroupName(group.id, e.target.value)}
                  placeholder={t("itemMaster.groupNamePlaceholder")}
                  className="h-9"
                />
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  aria-label={t("itemMaster.removeGroup")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-status-danger"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2 space-y-1.5 pl-1">
                {group.options.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input
                      value={option.label}
                      onChange={(e) => updateOption(group.id, option.id, { label: e.target.value })}
                      placeholder={t("itemMaster.optionLabelPlaceholder")}
                      className="h-8 flex-1 text-sm"
                    />
                    <Input
                      type="number"
                      step="any"
                      value={option.priceAdjustment}
                      onChange={(e) =>
                        updateOption(group.id, option.id, { priceAdjustment: Number(e.target.value) || 0 })
                      }
                      title={t("itemMaster.priceAdjustment")}
                      className="h-8 w-24 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(group.id, option.id)}
                      aria-label={t("itemMaster.removeOption")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-status-danger"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(group.id)}
                  className="flex items-center gap-1 pl-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  {t("itemMaster.addOption")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {errorText && <p className="text-xs text-status-danger">{errorText}</p>}
    </div>
  );
}
