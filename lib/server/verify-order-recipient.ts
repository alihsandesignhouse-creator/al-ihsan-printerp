import { getAdminDb } from "@/lib/firebase/admin";

/**
 * SEC-001 / SEC-002 ফিক্স (১৬ আগস্ট ২০২৬, external audit finding):
 *
 * আগে app/api/notifications/{send-sms,send-email,send-whatsapp,new-order}
 * — এই চারটা route-ই request body-তে আসা `orderId`, `branchId`,
 * `phone`/`email`, `customerName`, `orderNumber` — এসব সরাসরি বিশ্বাস
 * করে নিত, কখনো যাচাই করত না যে এই orderId আসলেই caller-এর টেন্যান্টে
 * বিদ্যমান কোনো অর্ডার কিনা, বা phone/email আসলেই সেই অর্ডারের
 * কাস্টমারের কিনা। ফলে টেন্যান্টের যেকোনো logged-in staff (এমনকি সবচেয়ে
 * কম-অনুমতির regular_staff) তার টেন্যান্টের পেইড SMS/Email/WhatsApp
 * কোটা ব্যবহার করে **যেকোনো** ফোন নম্বর/ইমেইলে কাস্টম মেসেজ পাঠাতে
 * পারতেন — orderId-টা বাস্তবে বিদ্যমান কিনা তা কখনো চেক হতো না।
 *
 * এই ফাংশনটা এখন প্রতিটা notification route-এর জন্য একক সোর্স-অফ-ট্রুথ:
 * orderId টেন্যান্টে সত্যিই বিদ্যমান কিনা যাচাই করে, এবং branchId +
 * customer-এর নাম/ফোন/ইমেইল সবসময় **ডাটাবেজ থেকে** নেয় — client-body-র
 * কোনো ভার্সন কখনো ব্যবহার করা হয় না। এভাবে recipient spoofing পুরোপুরি
 * বন্ধ হয়ে যায়, কারণ পাঠানো হয় সবসময় সেই অর্ডারের আসল কাস্টমারের কাছে,
 * client যা-ই পাঠাক না কেন।
 */
export interface VerifiedOrderRecipient {
  branchId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export async function verifyOrderAndLoadRecipient(
  tenantId: string,
  orderId: string
): Promise<VerifiedOrderRecipient | null> {
  const db = getAdminDb();

  const orderSnap = await db.collection("tenants").doc(tenantId).collection("orders").doc(orderId).get();
  if (!orderSnap.exists) return null;
  const order = orderSnap.data()!;

  // Order documents already denormalize customerName/customerPhone
  // (lib/types/dashboard.ts Order interface) — but those are snapshots
  // taken at order-creation time and can go stale if the customer record
  // is later edited. The live customers/{customerId} document is the
  // authoritative source for phone/email, so it's looked up fresh here;
  // the order's own denormalized fields are only used as a fallback if
  // the customer document is somehow missing (soft-deleted customer,
  // legacy data), never trusted over a live customer record.
  let customerName = (order.customerName as string) ?? "";
  let customerPhone = (order.customerPhone as string) ?? "";
  let customerEmail = "";

  const customerId = (order.customerId as string) ?? "";
  if (customerId) {
    const customerSnap = await db.collection("tenants").doc(tenantId).collection("customers").doc(customerId).get();
    if (customerSnap.exists) {
      const customer = customerSnap.data()!;
      customerName = (customer.name as string) ?? customerName;
      customerPhone = (customer.phone as string) ?? customerPhone;
      customerEmail = (customer.email as string) ?? "";
    }
  }

  return {
    branchId: (order.branchId as string) ?? "",
    orderNumber: (order.orderNumber as string) ?? "",
    customerId,
    customerName,
    customerPhone,
    customerEmail,
  };
}
