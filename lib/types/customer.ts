import type { Customer, CustomerFormData, Order, Payment } from "@/lib/types/order";

// Re-export so customer components only need to import from one place.
export type { Customer, CustomerFormData };

/**
 * Computed (never stored) financial summary for one customer, derived from
 * their non-deleted orders. totalPaid = totalBilled - totalDue, which stays
 * correct because order.dueAmount is only ever additively reduced by
 * recordPayment() inside a Firestore transaction (blueprint section 5.4) —
 * see lib/firebase/customers.ts:aggregateCustomerFinancials.
 */
export interface CustomerFinancialSummary {
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  orderCount: number;
}

export const EMPTY_CUSTOMER_FINANCIALS: CustomerFinancialSummary = {
  totalBilled: 0,
  totalPaid: 0,
  totalDue: 0,
  orderCount: 0,
};

/** One row in the customer list table — profile fields + computed financials. */
export interface CustomerListRow extends Customer {
  financials: CustomerFinancialSummary;
}

// Re-exported for convenience in customer components that need raw order/payment rows.
export type { Order, Payment };
