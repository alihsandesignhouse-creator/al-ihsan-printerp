"use client";

import { useTranslations } from "next-intl";
import { useConnectionStore } from "@/lib/stores/connection-store";

/**
 * Navbar connection indicator per blueprint section 5.3:
 * green dot "সংযুক্ত" / red dot "অফলাইন | X টি সিঙ্ক হয়নি" / amber "সিঙ্ক হচ্ছে..."
 */
export function ConnectionStatus() {
  const t = useTranslations();
  const isOnline = useConnectionStore((s) => s.isOnline);
  const isSyncing = useConnectionStore((s) => s.isSyncing);
  const pendingWrites = useConnectionStore((s) => s.pendingWrites);

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
        {t("common.syncing")}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-red-700">
        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
        {t("common.offline")}
        {pendingWrites > 0 && (
          <span>
            | {pendingWrites} {t("common.pendingSync")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
      <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
      {t("common.connected")}
    </div>
  );
}
