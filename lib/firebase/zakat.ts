import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import { round2 } from "@/lib/utils/calculations";
import { computeNetZakatableAssets, computeZakatDue } from "@/lib/utils/zakat-math";
import type { Order } from "@/lib/types/dashboard";
import type { Expense } from "@/lib/types/expense";
import type {
  ZakatYear,
  ZakatPayment,
  ZakatAssetsFormData,
  ZakatYearStartFormData,
  ZakatPaymentFormData,
  BusinessAssetsSnapshot,
} from "@/lib/types/zakat";

// ─── Zakat Year (ZK-01) ─────────────────────────────────────────────────────

/** যেকোনো সময়ে একজন Tenant Admin-এর সর্বোচ্চ ১টি সক্রিয় যাকাত বছর থাকে (এই সেশনের সিদ্ধান্ত, ব্লুপ্রিন্ট Hawl ট্র্যাকারের সরল বাস্তবায়ন)। */
export function subscribeActiveZakatYear(
  tenantId: string,
  callback: (year: ZakatYear | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "zakat_years");
  const q = query(colRef, where("status", "==", "active"), orderBy("createdAt", "desc"), fsLimit(1));

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.empty ? null : ({ id: snapshot.docs[0]!.id, ...snapshot.docs[0]!.data() } as ZakatYear)),
    (error) => onError(error as Error)
  );
}

export function subscribeZakatYearHistory(
  tenantId: string,
  callback: (years: ZakatYear[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "zakat_years");
  const q = query(colRef, where("status", "==", "completed"), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ZakatYear)),
    (error) => onError(error as Error)
  );
}

/** নতুন যাকাত বছর শুরু (Hawl শুরু) — সব আর্থিক ফিল্ড শূন্য দিয়ে শুরু হয়, ZK-01 ফর্মে পরে পূরণ হবে। */
export async function createZakatYear(tenantId: string, input: ZakatYearStartFormData): Promise<string> {
  const ref = doc(collection(db, "tenants", tenantId, "zakat_years"));
  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      id: ref.id,
      tenantId,
      hijriYear: input.hijriYear.trim(),
      hawlStart: Timestamp.fromDate(new Date(`${input.hawlStart}T00:00:00`)),
      hawlEnd: Timestamp.fromDate(new Date(`${input.hawlEnd}T00:00:00`)),
      businessAssets: 0,
      externalAssets: [],
      liabilities: [],
      nisabAmount: 0,
      netZakatableAssets: 0,
      zakatDue: 0,
      zakatPaid: 0,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return ref.id;
}

/** ZK-01 ফর্ম সেভ — netZakatableAssets ও zakatDue সার্ভারে (এই ফাংশনে) পুনর্গণনা করা হয়, ক্লায়েন্ট থেকে সরাসরি নেওয়া হয় না। */
export async function updateZakatYearAssets(tenantId: string, yearId: string, input: ZakatAssetsFormData): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "zakat_years", yearId);
  const netZakatableAssets = computeNetZakatableAssets(input.businessAssets, input.externalAssets, input.liabilities);
  const zakatDue = computeZakatDue(netZakatableAssets, input.nisabAmount);

  await runTransaction(db, async (tx) => {
    tx.update(ref, {
      businessAssets: round2(input.businessAssets),
      externalAssets: input.externalAssets.map((a) => ({ ...a, amount: round2(a.amount) })),
      liabilities: input.liabilities.map((l) => ({ ...l, amount: round2(l.amount) })),
      nisabAmount: round2(input.nisabAmount),
      netZakatableAssets,
      zakatDue,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function markZakatYearCompleted(tenantId: string, yearId: string): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "zakat_years", yearId);
  await runTransaction(db, async (tx) => {
    tx.update(ref, { status: "completed", updatedAt: serverTimestamp() });
  });
}

// ─── Zakat Payments (ZK-02) ─────────────────────────────────────────────────

export function subscribeZakatPayments(
  tenantId: string,
  zakatYearId: string,
  callback: (payments: ZakatPayment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const colRef = collection(db, "tenants", tenantId, "zakat_payments");
  const q = query(colRef, where("zakatYearId", "==", zakatYearId), orderBy("date", "desc"));

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ZakatPayment)),
    (error) => onError(error as Error)
  );
}

/** ZK-02: নতুন বিতরণ রেকর্ড — একই transaction-এ zakat_years.zakatPaid বৃদ্ধি করা হয় (T-05 recordPayment-এর dueAmount আপডেট প্যাটার্নের মতো)। */
export async function addZakatPayment(
  tenantId: string,
  zakatYearId: string,
  hijriYear: string,
  actorUid: string,
  input: ZakatPaymentFormData
): Promise<void> {
  const yearRef = doc(db, "tenants", tenantId, "zakat_years", zakatYearId);
  const paymentRef = doc(collection(db, "tenants", tenantId, "zakat_payments"));

  await runTransaction(db, async (tx) => {
    const yearSnap = await tx.get(yearRef);
    if (!yearSnap.exists()) throw new Error("zakat.yearNotFound");
    const year = yearSnap.data() as ZakatYear;

    tx.set(paymentRef, {
      id: paymentRef.id,
      tenantId,
      zakatYearId,
      hijriYear,
      date: Timestamp.fromDate(new Date(`${input.date}T00:00:00`)),
      amount: round2(input.amount),
      method: input.method.trim(),
      category: input.category,
      recipientName: input.recipientName.trim(),
      notes: input.notes.trim(),
      createdBy: actorUid,
      createdAt: serverTimestamp(),
    });

    tx.update(yearRef, {
      zakatPaid: round2(year.zakatPaid + input.amount),
      updatedAt: serverTimestamp(),
    });
  });
}

// ─── ব্যবসায়িক সম্পদের স্ন্যাপশট (ZK-01: "সফটওয়্যার থেকে সর্বশেষ ডেটা আনুন") ──
//
// এই সেশনের সিদ্ধান্ত: T-15 স্টক মডিউলে (lib/types/stock.ts, StockItem) কোনো
// একক-মূল্য/monetary value ফিল্ড নেই — শুধু currentStock (পরিমাণ)। তাই
// "স্টকের বর্তমান মূল্য" স্বয়ংক্রিয়ভাবে আনা সম্ভব নয়। এখানে শুধু নগদ
// (payments − expenses) ও কাস্টমার বকেয়া (orders.dueAmount) থেকে একটি
// প্রস্তাবিত সংখ্যা প্রি-ফিল করা হয় — ব্যবহারকারী চাইলে স্টক/অন্যান্য
// সম্পদ businessAssets-এ ম্যানুয়ালি যোগ করে নিতে পারেন। ওয়ান-টাইম fetch
// (getDocs, real-time নয়) কারণ এটি একটি ব্যবহারকারী-উদ্যোগে "রিফ্রেশ" অ্যাকশন।
export async function fetchBusinessAssetsSnapshot(tenantId: string): Promise<BusinessAssetsSnapshot> {
  const [paymentsSnap, expensesSnap, ordersSnap] = await Promise.all([
    // সেশন ২ (soft-delete cascade): cascade-soft-deleted payment বাদ দিতে
    // deletedAt==null — একক equality ফিল্টার, কোনো composite index লাগে না।
    getDocs(query(collection(db, "tenants", tenantId, "payments"), where("deletedAt", "==", null))),
    getDocs(query(collection(db, "tenants", tenantId, "expenses"), where("deletedAt", "==", null))),
    getDocs(query(collection(db, "tenants", tenantId, "orders"), where("deletedAt", "==", null))),
  ]);

  const totalPayments = paymentsSnap.docs.reduce((sum, d) => sum + (d.data().amount ?? 0), 0);
  const totalExpenses = expensesSnap.docs.reduce((sum, d) => sum + ((d.data() as Expense).amount ?? 0), 0);
  const totalReceivables = ordersSnap.docs.reduce((sum, d) => {
    const due = (d.data() as Order).dueAmount ?? 0;
    return due > 0 ? sum + due : sum;
  }, 0);

  const netCashPosition = round2(totalPayments - totalExpenses);
  const roundedReceivables = round2(totalReceivables);

  return {
    netCashPosition,
    totalReceivables: roundedReceivables,
    suggestedTotal: round2(netCashPosition + roundedReceivables),
  };
}
