import { useTranslations } from "next-intl";
import type { OrderStatus } from "@/lib/types/order";
import { ORDER_STATUS_CLASSES } from "@/lib/constants/status-colors";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className = "" }: OrderStatusBadgeProps) {
  const t = useTranslations();
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${ORDER_STATUS_CLASSES[status]} ${className}`}
    >
      {t(`orders.status.${status}`)}
    </span>
  );
}
