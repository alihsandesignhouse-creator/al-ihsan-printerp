import type { Order } from "@/lib/types/order";

// ─── Priority classification ────────────────────────────────────────────────

export type RowPriority = "overdue" | "urgent" | "normal";

const PRIORITY_RANK: Record<RowPriority, number> = {
  overdue: 0,
  urgent: 1,
  normal: 2,
};

export function getDeliveryMs(order: Order): number {
  return order.expectedDeliveryDate?.toDate?.().getTime() ?? 0;
}

export function isOverdue(order: Order): boolean {
  const date = order.expectedDeliveryDate?.toDate?.();
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function isToday(order: Order): boolean {
  const date = order.expectedDeliveryDate?.toDate?.();
  if (!date) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function daysOverdue(order: Order): number {
  const date = order.expectedDeliveryDate?.toDate?.();
  if (!date) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function daysLeft(order: Order): number {
  const date = order.expectedDeliveryDate?.toDate?.();
  if (!date) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = date.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

export function getRowPriority(order: Order): RowPriority {
  if (isOverdue(order)) return "overdue";
  if (order.isUrgent) return "urgent";
  return "normal";
}

// ─── Sort functions ─────────────────────────────────────────────────────────

/** Blueprint sort: Overdue > Urgent > Normal, then by delivery date asc within each group. */
export function sortByPriority(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const pa = PRIORITY_RANK[getRowPriority(a)];
    const pb = PRIORITY_RANK[getRowPriority(b)];
    if (pa !== pb) return pa - pb;
    return getDeliveryMs(a) - getDeliveryMs(b);
  });
}

/** Pure chronological sort — earliest delivery first. */
export function sortByDate(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => getDeliveryMs(a) - getDeliveryMs(b));
}

// ─── Filter — active orders only (exclude delivered + cancelled) ─────────────

export function filterActiveOrders(orders: Order[]): Order[] {
  return orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
}

// ─── Row highlight class ─────────────────────────────────────────────────────

/** Always apply highlight colour regardless of sort mode (blueprint: "সবসময় দৃশ্যমান"). */
export function rowHighlightClass(order: Order): string {
  if (isOverdue(order)) return "bg-red-50/70 hover:bg-red-50";
  if (order.isUrgent) return "bg-amber-50/70 hover:bg-amber-50";
  return "hover:bg-neutral-50";
}

export function cardHighlightClass(order: Order): string {
  if (isOverdue(order))
    return "border-red-200 bg-red-50/40";
  if (order.isUrgent)
    return "border-amber-200 bg-amber-50/40";
  return "border-neutral-200 bg-white";
}
