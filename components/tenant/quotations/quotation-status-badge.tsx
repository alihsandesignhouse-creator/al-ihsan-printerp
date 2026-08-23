import { useTranslations } from "next-intl";
import type { QuotationStatus } from "@/lib/types/quotation";
import { QUOTATION_STATUS_CLASSES } from "@/lib/constants/status-colors";

interface QuotationStatusBadgeProps {
  status: QuotationStatus;
  className?: string;
}

export function QuotationStatusBadge({ status, className = "" }: QuotationStatusBadgeProps) {
  const t = useTranslations();
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${QUOTATION_STATUS_CLASSES[status]} ${className}`}
    >
      {t(`quotations.status.${status}`)}
    </span>
  );
}
