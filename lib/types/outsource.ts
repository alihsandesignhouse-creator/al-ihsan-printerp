import type { Timestamp } from "firebase/firestore";

// ─── Outsource Tracking — Module T-17 (প্রিমিয়াম) ───────────────────────────
//
// Blueprint অংশ ৯, T-17:
//   "সংশ্লিষ্ট অর্ডার নম্বর
//    কাজের বিবরণ * | বাইরের প্রতিষ্ঠান *
//    পাঠানোর তারিখ * | প্রত্যাশিত ফেরতের তারিখ *
//    খরচ * | স্ট্যাটাস: পাঠানো / সম্পন্ন / ফেরত"
//
// AUDIT (৩১ জুলাই ২০২৬, item #৭): এতদিন শুধু planFeatures.outsourceTracking
// ফ্ল্যাগ ও sidebar লিংক ছিল, কোনো পেজ/CRUD ছিল না। এই মডিউল সেই gap বন্ধ
// করে — expenses.ts (T-13)-এর সাথে হুবহু একই soft-delete/audit-log প্যাটার্ন।
//
// ডিজাইন সিদ্ধান্ত: "সংশ্লিষ্ট অর্ডার নম্বর" একটা ঐচ্ছিক ফ্রি-টেক্সট ফিল্ড
// (orderId foreign-key নয়) — কারণ আউটসোর্স করা কাজ প্রায়ই কোনো নির্দিষ্ট
// অর্ডারের অংশ (যেমন লেমিনেশন বাইরে করানো) কিন্তু সবসময় একটা নির্দিষ্ট
// সিস্টেম-অর্ডারের সাথে ১:১ যুক্ত নাও হতে পারে (একাধিক অর্ডারের কমন কাজ
// একসাথে বাইরে পাঠানো, বা কোনো অর্ডার তৈরির আগেই বাইরের উদ্ধৃতি নেওয়া)।
// ফ্রি-টেক্সট রাখলে ব্যবহারকারী "PP-2026-0012, PP-2026-0015" এর মতো একাধিক
// নম্বরও লিখতে পারবেন, যা একটা কঠোর একক foreign-key দিয়ে সম্ভব হতো না।

export type OutsourceStatus = "sent" | "completed" | "returned";

export const OUTSOURCE_STATUSES: OutsourceStatus[] = ["sent", "completed", "returned"];

/** /tenants/{tenantId}/outsource_records/{recordId} */
export interface OutsourceRecord {
  id: string;
  tenantId: string;
  branchId: string;
  /** ঐচ্ছিক ফ্রি-টেক্সট — দেখুন উপরের ডিজাইন-সিদ্ধান্তের নোট। */
  relatedOrderNumber: string;
  workDescription: string;
  vendorName: string;
  sentDate: Timestamp;
  expectedReturnDate: Timestamp;
  cost: number;
  status: OutsourceStatus;
  createdBy: string;
  createdByName: string;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OutsourceFormData {
  relatedOrderNumber: string;
  workDescription: string;
  vendorName: string;
  sentDate: string; // yyyy-MM-dd (HTML date input)
  expectedReturnDate: string; // yyyy-MM-dd
  cost: number;
  status: OutsourceStatus;
  branchId: string;
}
