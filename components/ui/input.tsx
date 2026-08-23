import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onFocus, inputMode, ...props }, ref) => {
    // সংখ্যার ঘরে (type="number") ফোকাস হলে বিদ্যমান মান (যেমন ডিফল্ট "0")
    // সম্পূর্ণ সিলেক্ট হয়ে যায়, যাতে টাইপ করলে সেটা প্রতিস্থাপিত হয়ে যায় —
    // "0" এর আগে/পরে নতুন সংখ্যা জোড়া লেগে "05" এর মতো ভুল মান তৈরি হয় না।
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (type === "number") {
        e.target.select();
      }
      onFocus?.(e);
    };

    // বাগ-ফিক্স (২১ আগস্ট ২০২৬, মোবাইল-রেসপন্সিভ অডিট): type="number"
    // ইনপুটে আগে কোনো inputMode সেট করা হতো না — iOS-এ এতে একটা
    // পূর্ণ QWERTY-স্টাইল numpad (মাইনাস চিহ্ন ও "e" বাটনসহ, বৈজ্ঞানিক
    // নোটেশনের জন্য) দেখায়, যেটা দাম/পরিমাণ টাইপ করার জন্য অপ্রয়োজনীয়ভাবে
    // জটিল ও বিভ্রান্তিকর। inputMode="decimal" দিলে একটা পরিষ্কার,
    // দশমিক-বিন্দুসহ সহজ numeric keypad দেখায় — টাকার অঙ্ক/পরিমাণ টাইপ
    // করার জন্য standard mobile UX প্র্যাকটিস। এই কম্পোনেন্টটাই পুরো
    // অ্যাপে একমাত্র <input> — তাই একটাই জায়গায় ফিক্স করলে সব ফর্মেই
    // (অর্ডার, পেমেন্ট, খরচ, স্টক ইত্যাদি — ২৫টা number ইনপুট) প্রযোজ্য
    // হয়ে যায়। কোনো ফর্ম যদি ইচ্ছাকৃতভাবে ভিন্ন inputMode (যেমন পূর্ণসংখ্যা-
    // শুধু ক্ষেত্রে "numeric") চায়, সেটা props দিয়ে override করা যাবে —
    // এই ডিফল্ট শুধু কিছু না দেওয়া থাকলেই প্রযোজ্য হয়।
    const resolvedInputMode = inputMode ?? (type === "number" ? "decimal" : undefined);

    return (
      <input
        type={type}
        inputMode={resolvedInputMode}
        onFocus={handleFocus}
        className={cn(
          "flex h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm",
          "placeholder:text-neutral-400 transition-colors",
          "focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-status-danger aria-[invalid=true]:focus:ring-status-danger",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
