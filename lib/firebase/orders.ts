import {
  collection,
  collectionGroup,
  doc,
  documentId,
  query,
  where,
  orderBy,
  limit as fsLimit,
  startAfter,
  onSnapshot,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getIdToken } from "firebase/auth";
import { db, auth } from "./client";
import { createCustomerInTransaction } from "./customers";
import { logAction } from "./audit";
import {
  calcEffectiveLineTotal,
  calcSubtotal,
  calcDiscountAmount,
  calcTotalAmount,
  calcDueAmount,
  buildItemSummary,
  buildOfflineOrderNumber,
  round2,
  formatTaka,
} from "@/lib/utils/calculations";
import type {
  Order,
  OrderItem,
  OrderStatus,
  NewOrderFormInput,
  StaffOption,
  Payment,
} from "@/lib/types/order";

// ─── Staff list (for assignment dropdowns) ─────────────────────────────────

export async function getActiveStaffOptions(
  tenantId: string,
  branchId: string | "all"
): Promise<StaffOption[]> {
  const colRef = collection(db, "tenants", tenantId, "users");
  const constraints = [where("isActive", "==", true)] as const;
  const q =
    branchId === "all"
      ? query(colRef, ...constraints)
      : query(colRef, where("branchId", "==", branchId), ...constraints);

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: (data.name as string) ?? "",
        role: data.role as StaffOption["role"],
        branchId: (data.branchId as string | null) ?? null,
        isActive: (data.isActive as boolean) ?? false,
      };
    })
    .filter((u) => ["tenant_admin", "branch_manager", "commission_staff", "regular_staff"].includes(u.role));
}

// ─── Order list (real-time) ────────────────────────────────────────────────

export interface OrderSubscriptionFilters {
  branchId: string | "all";
  status: OrderStatus | "all";
  staffId: string | "all";
}

/**
 * Firestore-side page size for the order list. AUDIT finding (১৭ আগস্ট
 * ২০২৬): এই সংখ্যায় হার্ড-ক্যাপ ছিল কিন্তু কোনো পেজিনেশন বা ব্যবহারকারীর
 * জন্য সতর্কতা ছিল না — ৫০০+ অর্ডার হলে পুরনো অর্ডার নীরবে তালিকা থেকে
 * বাদ পড়ত। এখন `subscribeToOrders`-এর callback দ্বিতীয় প্যারামিটার হিসেবে
 * `hasMore` জানায় (snapshot ঠিক ORDERS_PAGE_SIZE-এর সমান হলে আরও থাকতে
 * পারে ধরে নেওয়া হয়), আর `loadMoreOrders()` দিয়ে পরের ব্যাচ আনা যায়।
 */
export const ORDERS_PAGE_SIZE = 500;

/**
 * Real-time order list subscription used by the order list page.
 * Always excludes soft-deleted orders. Status/staff filtering beyond what
 * Firestore can index efficiently is applied client-side after the snapshot.
 *
 * Sort key `expectedDeliveryDate` প্রায়ই ডুপ্লিকেট মান রাখে (একই দিনে
 * অনেক ডেলিভারি) — cursor-based pagination নির্ভরযোগ্য করতে `documentId()`
 * secondary orderBy হিসেবে যোগ করা হয়েছে (tie-breaker), যাতে `loadMoreOrders`
 * কোনো অর্ডার বাদ না দেয় বা ডুপ্লিকেট না দেখায়।
 *
 * `callback`-এর দ্বিতীয় আর্গুমেন্ট (`hasMore`) ঐচ্ছিক — পুরনো caller
 * (my-collection, pending-work, payments পেজ) যারা শুধু এক-প্যারামিটার
 * callback পাস করে তাদের কিছু বদলাতে হয়নি, TypeScript structurally সেগুলো
 * এখনো valid।
 */
export function subscribeToOrders(
  tenantId: string,
  filters: OrderSubscriptionFilters,
  callback: (orders: Order[], hasMore: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "orders");
  const baseConstraints = [
    where("deletedAt", "==", null),
    orderBy("expectedDeliveryDate", "asc"),
    orderBy(documentId(), "asc"),
    fsLimit(ORDERS_PAGE_SIZE),
  ] as const;

  const q =
    filters.branchId === "all"
      ? query(colRef, ...baseConstraints)
      : query(colRef, where("branchId", "==", filters.branchId), ...baseConstraints);

  return onSnapshot(
    q,
    (snapshot) => {
      let orders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
      const hasMore = snapshot.docs.length === ORDERS_PAGE_SIZE;
      if (filters.status !== "all") {
        orders = orders.filter((o) => o.status === filters.status);
      }
      if (filters.staffId !== "all") {
        orders = orders.filter(
          (o) => o.takenByStaffId === filters.staffId || o.assignedStaffId === filters.staffId
        );
      }
      callback(orders, hasMore);
    },
    onError
  );
}

/**
 * এক-বারের (non-realtime) পরের ব্যাচ — "আরও লোড করুন" বাটনের জন্য।
 * প্রথম ৫০০-এর "জীবন্ত" (live) উইন্ডো `subscribeToOrders`-এই থাকে;
 * এই ফাংশনের রেজাল্ট শুধু ঐ মুহূর্তের স্ন্যাপশট (static) — পরের পেজ লোড
 * করা বা ম্যানুয়াল রিফ্রেশ ছাড়া আপডেট হবে না। এটা একটা ইচ্ছাকৃত
 * trade-off: পুরো তালিকাকে realtime রাখতে হলে প্রতিটা পেজেই আলাদা
 * listener লাগত, যেটা খরচ ও জটিলতা বাড়ায় — বেশিরভাগ টেন্যান্টের ৫০০-এর
 * বেশি সক্রিয় অর্ডার হওয়াই বিরল, তাই "আরও লোড করুন" শুধু ব্যতিক্রমী
 * ক্ষেত্রে ব্যবহৃত হবে।
 *
 * cursor হিসেবে সর্বশেষ লোড হওয়া অর্ডারের `expectedDeliveryDate` ও `id`
 * ব্যবহার করা হয় — subscribeToOrders-এর orderBy সিকোয়েন্সের সাথে হুবহু
 * মিলিয়ে, নাহলে Firestore ভুল/অসামঞ্জস্যপূর্ণ কার্সার নেবে।
 */
export async function loadMoreOrders(
  tenantId: string,
  filters: Pick<OrderSubscriptionFilters, "branchId">,
  lastOrder: Pick<Order, "id" | "expectedDeliveryDate">
): Promise<{ orders: Order[]; hasMore: boolean }> {
  const colRef = collection(db, "tenants", tenantId, "orders");
  const baseConstraints = [
    where("deletedAt", "==", null),
    orderBy("expectedDeliveryDate", "asc"),
    orderBy(documentId(), "asc"),
    startAfter(lastOrder.expectedDeliveryDate, lastOrder.id),
    fsLimit(ORDERS_PAGE_SIZE),
  ] as const;

  const q =
    filters.branchId === "all"
      ? query(colRef, ...baseConstraints)
      : query(colRef, where("branchId", "==", filters.branchId), ...baseConstraints);

  const snapshot = await getDocs(q);
  const orders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
  return { orders, hasMore: snapshot.docs.length === ORDERS_PAGE_SIZE };
}

export function subscribeToOrder(
  tenantId: string,
  orderId: string,
  callback: (order: Order | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "tenants", tenantId, "orders", orderId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null),
    onError
  );
}

export function subscribeToOrderItems(
  tenantId: string,
  orderId: string,
  callback: (items: OrderItem[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "orders", orderId, "order_items");
  const q = query(colRef, orderBy("sortOrder", "asc"));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderItem)),
    onError
  );
}

export async function getOrderOnce(tenantId: string, orderId: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, "tenants", tenantId, "orders", orderId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null;
}

// ─── Create order (transactional) ──────────────────────────────────────────

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerId: string;
  customerPhone: string;
  totalAmount: number;
}

/**
 * Creates a new order, its order_items subcollection, a new customer document
 * (when newCustomer is provided instead of an existing customerId), and any
 * item-master entries the staff opted to save — all atomically.
 *
 * The orderNumber is written as a temporary "OFFLINE-{timestamp}" placeholder.
 * The generateOrderNumber Cloud Function (Firestore onCreate trigger) replaces
 * it with the sequential "PP-2026-XXXX" number once the write reaches the
 * server, per blueprint sections 5.4 and 13.5.
 */
export async function createOrder(
  tenantId: string,
  userId: string,
  input: NewOrderFormInput
): Promise<CreateOrderResult> {
  const lineTotals = input.items.map((it) =>
    calcEffectiveLineTotal(it.quantity, it.unitPrice, it.totalOverride)
  );
  const subtotal = calcSubtotal(lineTotals);
  const discountAmount = calcDiscountAmount(subtotal, input.discountType, input.discountValue);
  const totalAmount = calcTotalAmount(subtotal, discountAmount, input.adjustment);
  const dueAmount = calcDueAmount(totalAmount, input.advanceAmount);
  const itemSummary = buildItemSummary(input.items.map((it) => it.itemName));
  const tempOrderNumber = buildOfflineOrderNumber();

  // "সরাসরি ডেলিভারড হিসেবে সেভ করুন" (১২ আগস্ট ২০২৬) — চেকবক্স চেক করা থাকলে
  // orderNumber এখনো OFFLINE-{timestamp} থেকেই শুরু হয় (generateOrderNumber
  // পোলিং ফাংশন যথারীতি সিকোয়েন্সিয়াল নম্বর বসাবে), শুধু status ও deliveredAt
  // ভিন্নভাবে বসে। deliveredDate না দিলে (ফর্মে ডিফল্ট আজকের তারিখ থাকে) আজকের
  // তারিখই ধরা হয়।
  const initialStatus: OrderStatus = input.markAsDelivered ? "delivered" : "pending";
  const initialDeliveredAt = input.markAsDelivered
    ? Timestamp.fromDate(input.deliveredDate ? new Date(input.deliveredDate) : new Date())
    : null;

  const orderRef = doc(collection(db, "tenants", tenantId, "orders"));

  const result = await runTransaction(db, async (tx) => {
    let customerId = input.customerId;

    if (!customerId && input.newCustomer) {
      customerId = createCustomerInTransaction(tx, tenantId, input.newCustomer);
    }
    if (!customerId) {
      throw new Error("validation.customerRequired");
    }

    let customerName = "";
    let customerPhone = "";
    if (input.customerId) {
      const customerSnap = await tx.get(doc(db, "tenants", tenantId, "customers", input.customerId));
      if (!customerSnap.exists()) throw new Error("orders.customerNotFound");
      const cData = customerSnap.data();
      customerName = (cData.name as string) ?? "";
      customerPhone = (cData.phone as string) ?? "";
    } else if (input.newCustomer) {
      customerName = input.newCustomer.name;
      customerPhone = input.newCustomer.phone;
    }

    tx.set(orderRef, {
      id: orderRef.id,
      tenantId,
      branchId: input.branchId,
      orderNumber: tempOrderNumber,
      customerId,
      customerName,
      customerPhone,
      itemSummary,
      status: initialStatus,
      expectedDeliveryDate: Timestamp.fromDate(new Date(input.expectedDeliveryDate)),
      assignedStaffId: input.assignedStaffId || null,
      takenByStaffId: userId,
      isUrgent: input.isUrgent,
      subtotal,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount,
      adjustment: input.adjustment,
      adjustmentNote: input.adjustmentNote,
      totalAmount,
      advanceAmount: input.advanceAmount,
      advanceMethod: input.advanceAmount > 0 ? input.advanceMethod || null : null,
      dueAmount,
      notes: input.notes,
      createdBy: userId,
      deletedAt: null,
      deletedBy: null,
      deliveredAt: initialDeliveredAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    input.items.forEach((item, index) => {
      const itemRef = doc(collection(db, "tenants", tenantId, "orders", orderRef.id, "order_items"));
      tx.set(itemRef, {
        id: itemRef.id,
        orderId: orderRef.id,
        itemName: item.itemName.trim(),
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: lineTotals[index],
        addToItemMaster: item.addToItemMaster,
        sortOrder: index,
        selectedAttributes: item.selectedAttributes ?? [],
      });

      if (item.addToItemMaster) {
        const masterRef = doc(collection(db, "tenants", tenantId, "items"));
        tx.set(masterRef, {
          id: masterRef.id,
          tenantId,
          name: item.itemName.trim(),
          defaultUnitPrice: item.unitPrice,
          deletedAt: null,
          deletedBy: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    if (input.advanceAmount > 0) {
      const paymentRef = doc(collection(db, "tenants", tenantId, "payments"));
      tx.set(paymentRef, {
        id: paymentRef.id,
        tenantId,
        branchId: input.branchId,
        orderId: orderRef.id,
        customerId,
        amount: round2(input.advanceAmount),
        paymentMethod: input.advanceMethod || "cash",
        referenceNumber: null,
        collectedBy: userId,
        paymentDate: serverTimestamp(),
        notes: "orders.advancePaymentNote",
        deletedAt: null,
        deletedBy: null,
        createdAt: serverTimestamp(),
      });
    }

    return { orderId: orderRef.id, orderNumber: tempOrderNumber, customerName, customerId, customerPhone, totalAmount };
  });

  void logAction(tenantId, "order.created", "order", result.orderId, {
    orderNumber: result.orderNumber,
    branchId: input.branchId,
    totalAmount,
    isUrgent: input.isUrgent,
  });

  // Direct-Call Pattern (Free Edition): replace `notifyOnNewOrder` Cloud
  // Function trigger. Best-effort — UI never blocks or shows an error if
  // this fails.
  void fireNewOrderNotification(tenantId, result.orderId);

  // Phase 3 (blueprint modules #28/#29): real SMS/Email order-confirmation.
  // Best-effort, non-blocking — silently skipped for non-Premium tenants
  // (checked server-side in the API route, not here) and for customers
  // with no phone/email on file.
  void fireOrderConfirmationMessages(
    tenantId,
    result.orderId,
    result.orderNumber,
    result.customerId,
    result.customerPhone,
    totalAmount
  );

  return result;
}

/**
 * Sends the new-order notification to the API route.
 *
 * SEC-002 fix (১৬ আগস্ট ২০২৬ external audit): only `orderId` is sent —
 * `branchId`/`orderNumber`/`customerName` used to be passed here from the
 * client and trusted as-is by the API route; they're now always derived
 * server-side from the real order document (see
 * app/api/notifications/new-order/route.ts), so passing them here would
 * have been both redundant and misleading.
 */
export async function fireNewOrderNotification(tenantId: string, orderId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  let token: string;
  try {
    token = await getIdToken(currentUser);
  } catch {
    return;
  }

  try {
    await fetch("/api/notifications/new-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[orders] fireNewOrderNotification failed:", err);
    }
  }
}

// ─── Phase 3: real SMS/Email sending (blueprint modules #28/#29) ──────────

/**
 * Fires the "orderConfirmation" SMS (always attempted if a phone number is
 * on file) and Email (attempted only if the customer has an email on file —
 * order documents don't carry it, so it's looked up once here) via the
 * Direct-Call Pattern API routes. Both are premium-plan-gated server-side
 * (app/api/notifications/send-sms|send-email), so this is safe to call
 * unconditionally for every tenant — Basic/Standard tenants simply get a
 * silent no-op back.
 *
 * Best-effort, non-blocking, same shape as fireNewOrderNotification — never
 * throws, never shows the user an error.
 */
export async function fireOrderConfirmationMessages(
  tenantId: string,
  orderId: string,
  orderNumber: string,
  customerId: string,
  customerPhone: string,
  totalAmount: number
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  let token: string;
  try {
    token = await getIdToken(currentUser);
  } catch {
    return;
  }

  const params = { orderNumber, totalAmount: formatTaka(totalAmount) };

  if (customerPhone) {
    void fireSmsNotification(token, "orderConfirmation", orderId, params);
  }

  try {
    const customerSnap = await getDoc(doc(db, "tenants", tenantId, "customers", customerId));
    const email = customerSnap.exists() ? ((customerSnap.data().email as string) ?? "") : "";
    if (email) {
      void fireEmailNotification(token, "orderConfirmation", orderId, {
        ...params,
        customerName: customerSnap.data()?.name ?? "",
      });
    }
  } catch {
    // best-effort — a failed customer lookup just means no email attempt
  }
}

/**
 * Fires the "paymentReceived" SMS (Email intentionally skipped for this
 * event in the current session — see MODULE_README "এখনো বাকি" for the
 * follow-up to look up the customer's email here too, mirroring
 * fireOrderConfirmationMessages above).
 */
export async function firePaymentReceivedSms(
  orderId: string,
  customerPhone: string,
  amount: number,
  dueAmount: number
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !customerPhone) return;

  let token: string;
  try {
    token = await getIdToken(currentUser);
  } catch {
    return;
  }

  void fireSmsNotification(token, "paymentReceived", orderId, {
    amount: formatTaka(amount),
    dueAmount: formatTaka(dueAmount),
  });
}

async function fireSmsNotification(
  token: string,
  event: "orderConfirmation" | "paymentReceived" | "deliveryReminder" | "dueReminder",
  orderId: string,
  params: Record<string, string>
): Promise<void> {
  try {
    // SEC-001 fix (১৬ আগস্ট ২০২৬): branchId/phone আর body-তে পাঠানো হয় না —
    // সার্ভার এখন orderId থেকে verifyOrderAndLoadRecipient() দিয়ে আসল
    // branchId ও recipient phone নিজেই লোড করে, client-supplied ভার্সন আর
    // বিশ্বাস করা হয় না (দেখুন app/api/notifications/send-sms/route.ts)।
    await fetch("/api/notifications/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event, orderId, params }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[orders] fireSmsNotification (${event}) failed:`, err);
    }
  }
}

async function fireEmailNotification(
  token: string,
  event: "orderConfirmation" | "paymentReceived" | "deliveryReminder" | "dueReminder",
  orderId: string,
  params: Record<string, string>
): Promise<void> {
  try {
    // SEC-001 fix — same rationale as fireSmsNotification above.
    await fetch("/api/notifications/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event, orderId, params }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[orders] fireEmailNotification (${event}) failed:`, err);
    }
  }
}

// ─── Status / assignment ───────────────────────────────────────────────────

export async function updateOrderStatus(
  tenantId: string,
  orderId: string,
  status: OrderStatus
): Promise<void> {
  let previousStatus: OrderStatus | null = null;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "tenants", tenantId, "orders", orderId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("orders.notFound");
    previousStatus = (snap.data().status as OrderStatus) ?? null;
    // স্বাভাবিক ফ্লো-তে (Pending→...→Delivered) status যখনই 'delivered'-এ
    // পৌঁছায়, deliveredAt-ও এখানেই স্ট্যাম্প হয় — যাতে createOrder()-এর
    // "সরাসরি ডেলিভারড" পথে তৈরি অর্ডারের সাথে ডেটা সামঞ্জস্যপূর্ণ থাকে (দুটো
    // পথের কোনোটাতেই deliveredAt বাদ না পড়ে)। অন্য কোনো status-এ deliveredAt
    // স্পর্শ করা হয় না (already-delivered অর্ডার ভুলবশত অন্য status-এ গেলেও
    // মূল ডেলিভারির তারিখ হারিয়ে যাবে না)।
    tx.update(ref, {
      status,
      updatedAt: serverTimestamp(),
      ...(status === "delivered" ? { deliveredAt: serverTimestamp() } : {}),
    });
  });

  void logAction(tenantId, "order.status_changed", "order", orderId, {
    from: previousStatus,
    to: status,
  });
}

export async function reassignStaff(
  tenantId: string,
  orderId: string,
  staffId: string
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "orders", orderId);
  let previousStaffId: string | null = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("orders.notFound");
    previousStaffId = (snap.data().assignedStaffId as string | null) ?? null;
    tx.update(ref, { assignedStaffId: staffId, updatedAt: serverTimestamp() });
  });

  void logAction(tenantId, "order.staff_reassigned", "order", orderId, {
    from: previousStaffId,
    to: staffId,
  });
}

/**
 * ইউজার-ফিডব্যাক সেশন ২ (১৮ আগস্ট ২০২৬): অর্ডার সফট-ডিলিট করলে এখন
 * সংশ্লিষ্ট সব payment ডকুমেন্টও একই transaction-এ cascade-soft-delete
 * হয়ে যায় (deletedAt/deletedBy) — যাতে পেমেন্ট হিস্ট্রি, রিপোর্ট, ও
 * কালেকশন KPI সব জায়গা থেকে একসাথে সরে যায়। এটা "অর্ডার ডিলিট" (destructive,
 * সব ট্রেস সরানো)-এর জন্য প্রযোজ্য — "অর্ডার ক্যানসেল" (order-status-control.tsx-এর
 * status='cancelled' আপডেট, updateOrderStatus() দিয়ে) সম্পূর্ণ আলাদা
 * কোড-পাথ যেখানে পেমেন্ট হিস্ট্রি অক্ষত থাকে। হার্ড-ডিলিট নয়, শুধু
 * deletedAt ফ্ল্যাগ — প্রজেক্টের নিয়ম "soft delete only, never hard delete"।
 *
 * Firestore-এর JS ক্লায়েন্ট SDK-তে transaction.get() শুধু একটা একক
 * DocumentReference নেয়, Admin SDK-র মতো Query নেয় না — তাই সংশ্লিষ্ট
 * payment ডকুমেন্টগুলোর রেফারেন্স transaction শুরুর *আগে* একটা সাধারণ
 * query দিয়ে জোগাড় করে নেওয়া হয়, তারপর প্রতিটা রেফারেন্স transaction-এর
 * ভেতরে আলাদাভাবে tx.get()/tx.update() করা হয় (সব read আগে, তারপর সব
 * write — Firestore transaction-এর নিয়ম মেনে)।
 */
export async function softDeleteOrder(
  tenantId: string,
  orderId: string,
  userId: string
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "orders", orderId);

  const paymentsQuery = query(
    collection(db, "tenants", tenantId, "payments"),
    where("orderId", "==", orderId),
    where("deletedAt", "==", null)
  );
  const paymentsSnap = await getDocs(paymentsQuery);
  const paymentRefs = paymentsSnap.docs.map((d) => d.ref);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("orders.notFound");

    // Firestore-এর নিয়ম: transaction-এর সব read, সব write-এর আগে হতে হবে।
    const paymentSnaps = await Promise.all(paymentRefs.map((paymentRef) => tx.get(paymentRef)));

    tx.update(ref, {
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });

    for (const paymentSnap of paymentSnaps) {
      if (!paymentSnap.exists()) continue; // race condition-এ ইতিমধ্যে সরানো হয়ে থাকতে পারে
      tx.update(paymentSnap.ref, {
        deletedAt: serverTimestamp(),
        deletedBy: userId,
      });
    }
  });

  void logAction(tenantId, "order.soft_deleted", "order", orderId, {
    cascadedPaymentCount: paymentRefs.length,
  });
}

// ─── Payments (additive, transactional) ────────────────────────────────────

export interface RecordPaymentInput {
  orderId: string;
  amount: number;
  paymentMethod: Order["advanceMethod"] extends infer T ? NonNullable<T> : never;
  referenceNumber: string;
  notes: string;
}

/**
 * Records a payment as an append-only ledger entry and additively reduces
 * the order's dueAmount inside a transaction — never replaces a prior value,
 * per blueprint section 5.4: "পেমেন্ট সবসময় যোগ হবে, replace নয়".
 */
export async function recordPayment(
  tenantId: string,
  userId: string,
  input: RecordPaymentInput
): Promise<void> {
  const orderRef = doc(db, "tenants", tenantId, "orders", input.orderId);
  const paymentRef = doc(collection(db, "tenants", tenantId, "payments"));

  const { customerPhone, newDue } = await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("orders.notFound");
    const order = orderSnap.data() as Order;

    // AUDIT-REPORT-3.md Issue #4 fix: mirrors stock.ts's negative-stock
    // guard — reject in the client transaction (clear, translated error)
    // rather than only relying on the Firestore rules check (a raw
    // permission-denied) which now also enforces this server-side.
    if (round2(input.amount) > order.dueAmount) {
      throw new Error("orders.amountExceedsDue");
    }

    const newDue = round2(order.dueAmount - input.amount);

    tx.set(paymentRef, {
      id: paymentRef.id,
      tenantId,
      branchId: order.branchId,
      orderId: input.orderId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      amount: round2(input.amount),
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber || null,
      collectedBy: userId,
      paymentDate: serverTimestamp(),
      notes: input.notes,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
    });

    // AUDIT-REPORT-5.md Issue #1 fix (৪ আগস্ট ২০২৬): lastPaymentId lets
    // firestore.rules cryptographically tie this dueAmount decrease to the
    // payment doc written in this same transaction (via getAfter()) for
    // commission_staff/regular_staff callers — previously a staff-role
    // raw-SDK write could set dueAmount to any lower value with no
    // payment record at all (silent debt write-off, no ledger trail).
    // Harmless no-op for tenant_admin/branch_manager, whose update rule
    // branch has no field restriction.
    tx.update(orderRef, { dueAmount: newDue, updatedAt: serverTimestamp(), lastPaymentId: paymentRef.id });

    return { branchId: order.branchId, customerPhone: order.customerPhone, newDue };
  });

  void logAction(tenantId, "payment.recorded", "payment", paymentRef.id, {
    orderId: input.orderId,
    amount: round2(input.amount),
    paymentMethod: input.paymentMethod,
  });

  // Phase 3 (blueprint module #28): real "paymentReceived" SMS. Best-effort.
  void firePaymentReceivedSms(input.orderId, customerPhone, input.amount, newDue);
}

export function subscribeToOrderPayments(
  tenantId: string,
  orderId: string,
  callback: (payments: import("@/lib/types/order").Payment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "payments");
  // সেশন ২ (soft-delete cascade): cascade-soft-deleted payment বাদ দিতে
  // deletedAt==null যোগ হলো — composite index (orderId ASC, deletedAt ASC,
  // paymentDate DESC), দেখুন firestore.indexes.json।
  const q = query(
    colRef,
    where("orderId", "==", orderId),
    where("deletedAt", "==", null),
    orderBy("paymentDate", "desc")
  );
  return onSnapshot(
    q,
    (snapshot) =>
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as import("@/lib/types/order").Payment)),
    onError
  );
}

export interface PaymentSubscriptionFilters {
  /** 'all' বা নির্দিষ্ট শাখার id */
  branchId: string;
}

/**
 * Module T-05 (blueprint SA/T-05, audit item #3): tenant-wide payments
 * ledger for /dashboard/payments. Same query-shape convention as
 * subscribeToOrders() above — one indexed Firestore where() (branchId) +
 * a row cap, everything else (method/customer/date-range search) filtered
 * client-side in the page component so this stays a single cheap
 * subscription regardless of how many filters the user has active.
 */
export function subscribeToTenantPayments(
  tenantId: string,
  filters: PaymentSubscriptionFilters,
  callback: (payments: Payment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "payments");
  // সেশন ২ (soft-delete cascade): cascade-soft-deleted payment বাদ দিতে
  // deletedAt==null যোগ হলো — composite index (deletedAt ASC, paymentDate DESC)
  // এবং (branchId ASC, deletedAt ASC, paymentDate DESC), দেখুন firestore.indexes.json।
  const baseConstraints = [
    where("deletedAt", "==", null),
    orderBy("paymentDate", "desc"),
    fsLimit(500),
  ] as const;

  const q =
    filters.branchId === "all"
      ? query(colRef, ...baseConstraints)
      : query(colRef, where("branchId", "==", filters.branchId), ...baseConstraints);

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment)),
    onError
  );
}

// Collection group export kept for future cross-tenant Super Admin tooling — unused by tenant UI.
export const ordersCollectionGroup = () => collectionGroup(db, "orders");
