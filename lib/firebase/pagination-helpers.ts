import {
  query,
  onSnapshot,
  getDocs,
  orderBy,
  limit as fsLimit,
  startAfter,
  documentId,
  type QueryConstraint,
  type Unsubscribe,
  type CollectionReference,
  type DocumentData,
} from "firebase/firestore";

/**
 * lib/firebase/pagination-helpers.ts
 *
 * পুনর্ব্যবহারযোগ্য cursor-pagination হেল্পার (audit ফিক্স, ১৭ আগস্ট ২০২৬)।
 * `lib/firebase/orders.ts`-এর `subscribeToOrders`/`loadMoreOrders`-এ প্রথম
 * এই প্যাটার্নটা বানানো হয়েছিল (orders তালিকার ৫০০-ক্যাপ নীরবে ডেটা বাদ
 * দেওয়ার বাগ ফিক্স করতে) — এখন customers/items/expenses/quotations/
 * suppliers/stock_items/outsource_records-এও একই সমস্যা পাওয়া গেছে, তাই
 * কোড ৭ বার ডুপ্লিকেট না করে এই একটা জেনেরিক হেল্পারে সরানো হলো।
 *
 * প্রতিটা query-তে `orderBy(documentId())` একটা secondary tie-breaker
 * হিসেবে যোগ করা হয় — sort field-এ (নাম, তারিখ ইত্যাদি) ডুপ্লিকেট মান
 * থাকলেও (যেমন একই নামে একাধিক গ্রাহক, একই দিনে একাধিক খরচ) cursor
 * pagination নির্ভরযোগ্য থাকে, কোনো রেকর্ড বাদ পড়ে না বা দুইবার আসে না।
 *
 * বিদ্যমান `firestore.indexes.json`-এর composite index-গুলো ইতিমধ্যে এই
 * pattern-এর জন্য যথেষ্ট — Firestore প্রতিটা composite index-এর শেষে
 * স্বয়ংক্রিয়ভাবে document ID-কে implicit tie-breaker হিসেবে যোগ করে,
 * তাই `orderBy(documentId())` কোনো নতুন index তৈরি করা লাগেনি।
 */

export const DEFAULT_PAGE_SIZE = 500;

/**
 * প্রথম পেজ — realtime (live)। callback-এর দ্বিতীয় আর্গুমেন্ট `hasMore`
 * জানায় শেষ ব্যাচ ঠিক `pageSize`-এর সমান কিনা (অর্থাৎ আরও থাকতে পারে)।
 */
export function subscribePagedList<T extends { id: string }>(
  colRef: CollectionReference<DocumentData>,
  constraints: QueryConstraint[],
  sortField: string,
  sortDirection: "asc" | "desc",
  callback: (items: T[], hasMore: boolean) => void,
  onError: (error: Error) => void,
  pageSize: number = DEFAULT_PAGE_SIZE
): Unsubscribe {
  const q = query(
    colRef,
    ...constraints,
    orderBy(sortField, sortDirection),
    orderBy(documentId(), sortDirection),
    fsLimit(pageSize)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
      callback(items, snapshot.docs.length === pageSize);
    },
    onError
  );
}

/**
 * পরের পেজ — এক-বারের (non-realtime) fetch, "আরও লোড করুন" বাটনের জন্য।
 * `cursorSortValue`/`cursorId` অবশ্যই আগের ব্যাচের **সর্বশেষ** আইটেমের
 * sort-field মান ও `id` হতে হবে — `subscribePagedList`-এর orderBy
 * সিকোয়েন্সের সাথে হুবহু মিলিয়ে, নাহলে Firestore ভুল কার্সার নেবে।
 */
export async function loadMorePagedList<T extends { id: string }>(
  colRef: CollectionReference<DocumentData>,
  constraints: QueryConstraint[],
  sortField: string,
  sortDirection: "asc" | "desc",
  cursorSortValue: unknown,
  cursorId: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<{ items: T[]; hasMore: boolean }> {
  const q = query(
    colRef,
    ...constraints,
    orderBy(sortField, sortDirection),
    orderBy(documentId(), sortDirection),
    startAfter(cursorSortValue, cursorId),
    fsLimit(pageSize)
  );
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  return { items, hasMore: snapshot.docs.length === pageSize };
}
