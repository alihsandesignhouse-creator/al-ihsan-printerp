import type { Timestamp } from "firebase/firestore";

// ─── Order Costing — Module T-11 (স্ট্যান্ডার্ড+) ──────────────────────────
// /tenants/{tenantId}/order_costings/{orderId} — doc ID == orderId, a 1:1
// costing record attached to a single order. Orders without a costing
// record are flagged separately (order.hasCosting) so commission (T-12)
// only ever counts costed orders, per blueprint T-11/T-12.

export interface OrderCosting {
  id: string; // == orderId
  tenantId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  rawMaterialCost: number;
  laborCost: number;
  otherCost: number;
  totalCosting: number; // auto = rawMaterialCost + laborCost + otherCost
  /** If populated via "কস্ট ক্যালকুলেটর থেকে আমদানি" — id of the source T-10 saved calculation. */
  sourceCalculationId: string | null;
  /**
   * ১৬ আগস্ট ২০২৬ যোগ হলো — কাঁচামালের খরচ কোন সাপ্লায়ারের কাছ থেকে নেওয়া
   * হয়েছে, শুধু তথ্যের জন্য ট্যাগ (order_costings লেখার rule-এ কোনো field
   * restriction নেই, তাই commission_staff-ও নিজের অর্ডারে এটা সেট করতে
   * পারবেন)। কোনো শাখার supplier-ই এখানে নির্বাচনযোগ্য, যেহেতু ফর্মে
   * dropdown order.branchId দিয়ে filter করা।
   */
  supplierId: string | null;
  supplierName: string | null;
  /**
   * সাপ্লায়ার লেজারে ("purchase" টাইপ /supplier_transactions ডকুমেন্ট)
   * এটা যোগ করা হয়ে থাকলে সেই ডকুমেন্টের ID — শুধু TENANT_ADMIN/
   * BRANCH_MANAGER "লেজারে যোগ করুন" বাটনে ক্লিক করলে সেট হয় (দেখুন
   * lib/firebase/suppliers.ts::linkCostingToSupplierLedger)। supplier_
   * transactions কালেকশন append-only (কোনো update/delete rule নেই) —
   * তাই এটা একবার সেট হলে আর unlink করা যায় না, নতুন সংশোধনী এন্ট্রি
   * দিতে হবে সাপ্লায়ার পেজ থেকে ম্যানুয়ালি।
   */
  supplierTransactionId: string | null;
  note: string;
  enteredBy: string;
  enteredByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrderCostingFormData {
  rawMaterialCost: number;
  laborCost: number;
  otherCost: number;
  note: string;
  sourceCalculationId: string | null;
  supplierId: string | null;
  supplierName: string | null;
}
