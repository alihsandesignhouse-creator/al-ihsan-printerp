import { type ReactNode } from "react";

/**
 * Shared shell for /login, /signup, /forgot-password. The <html>/<body>
 * tags live in the true root layout (app/layout.tsx).
 *
 * বাগ-ফিক্স (১২ আগস্ট ২০২৬): এই লেআউট আগে একটা কেন্দ্রীভূত `max-w-md`
 * কার্ড-শেল দিত (পুরনো ডিজাইনের জন্য বানানো)। কিন্তু ৯ আগস্ট ২০২৬-এর
 * প্রিমিয়াম রিডিজাইনে পেজগুলো `AuthSplitLayout` ব্যবহার করে, যেটা নিজেই
 * একটা ফুল-স্ক্রিন (`min-h-screen`, ৪৬%/৫৪% স্প্লিট) শেল — তার নিজের
 * কোনো বাইরের max-width wrapper দরকার নেই। দুটো wrapper একসাথে বসায়
 * ডান পাশের ব্র্যান্ড প্যানেল ৪৪৮px বক্সের ভেতরে চিপকে/ভেঙে যাচ্ছিল।
 * তাই এখন এই লেআউট শুধু pass-through — আসল লেআউট কন্ট্রোল পুরোপুরি
 * AuthSplitLayout-এর হাতে।
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
