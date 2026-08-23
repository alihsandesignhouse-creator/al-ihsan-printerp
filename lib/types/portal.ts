import type { OrderStatus } from "@/lib/types/order";

/** One line item as returned by the getPortalOrderStatus Cloud Function. */
export interface PortalOrderItem {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Shape of a successful /api/portal/track response. Dates are ISO strings
 * (not Firestore Timestamp instances) since this crosses an HTTP boundary —
 * see functions/src/portalFunctions.ts.
 */
export interface PortalTrackingResult {
  tenant: {
    name: string;
    logoUrl: string;
    address: string;
    invoiceFooterMessage: string;
  };
  branch: { name: string; address: string } | null;
  order: {
    orderNumber: string;
    status: OrderStatus;
    isUrgent: boolean;
    customerName: string;
    customerPhone: string;
    createdAt: string | null;
    updatedAt: string | null;
    expectedDeliveryDate: string | null;
    subtotal: number;
    discountAmount: number;
    adjustment: number;
    totalAmount: number;
    advanceAmount: number;
    dueAmount: number;
  };
  items: PortalOrderItem[];
}
