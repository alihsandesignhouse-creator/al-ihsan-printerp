import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

interface LockedFeatureNoticeProps {
  messageKey: string;
}

export function LockedFeatureNotice({ messageKey }: LockedFeatureNoticeProps) {
  const t = useTranslations();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
      <div>
        <p className="text-sm text-neutral-600">{t(messageKey)}</p>
        <p className="mt-1 text-xs text-neutral-500">{t("settings.locked.contact")}</p>
      </div>
    </div>
  );
}
