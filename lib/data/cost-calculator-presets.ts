// ─── Cost Calculator — বিল্ট-ইন কুইক-স্টার্ট প্রিসেট (audit item #৫) ────────
//
// Blueprint অংশ ৯ (T-10)-এর মূল ডিজাইন অপরিবর্তিত থাকে — কোনো নির্দিষ্ট
// ক্যাটাগরি বাধ্যতামূলক নয়, ব্যবহারকারী সম্পূর্ণ স্বাধীনভাবে যোগ/সরাতে
// পারবেন। এই প্রিসেটগুলো শুধু একটা "মাথা শুরু করার জায়গা" — বাংলাদেশের
// প্রিন্টিং প্রেসের সাধারণ কাজের ধরন অনুযায়ী কয়েকটা প্রচলিত খরচ-বিভাগের
// নাম আগে থেকে বসিয়ে দেয়, যাতে খালি ফর্ম দেখে নতুন ব্যবহারকারী দ্বিধায়
// না পড়েন। প্রিসেট লোড করার পরেও প্রতিটা নাম সম্পূর্ণ সম্পাদনাযোগ্য —
// এটা টেমপ্লেট লোড করারই মতো আচরণ (নাম বসে, পরিমাণ/মূল্য খালি থাকে)।
//
// ডিজাইন সিদ্ধান্ত: ক্যাটাগরির নাম bn/en উভয় ভাষায় রাখা হয়েছে (next-intl
// এর t() দিয়ে নয়) কারণ প্রিসেট লোড হওয়ার পরে এই টেক্সট একটা সাধারণ
// ব্যবহারকারী-সম্পাদনাযোগ্য ডেটা হয়ে যায় (যেমন সেভ করা টেমপ্লেটের নামও
// প্লেইন স্ট্রিং, i18n key নয়) — ভাষা টগলের সাথে সামঞ্জস্যপূর্ণ থাকতে
// লোড হওয়ার মুহূর্তে বর্তমান locale অনুযায়ী bn/en থেকে একটা বেছে নেওয়া
// হয়। প্রিসেটের বাটন-লেবেল ও আইকন অবশ্য স্বাভাবিক t() দিয়েই অনুবাদ হয়
// (এগুলো স্থায়ী UI টেক্সট, ব্যবহারকারীর ডেটা নয়)।

export interface CostCalculatorPreset {
  key: string;
  /** messages/*.json এর "costing.presets.<key>" এর সাথে মেলে */
  labelKey: string;
  categoryNames: { bn: string; en: string }[];
}

export const COST_CALCULATOR_PRESETS: CostCalculatorPreset[] = [
  {
    key: "general",
    labelKey: "costing.presets.general",
    categoryNames: [
      { bn: "কাগজের খরচ", en: "Paper Cost" },
      { bn: "প্লেট খরচ", en: "Plate Cost" },
      { bn: "প্রিন্টিং চার্জ", en: "Printing Charge" },
      { bn: "বাইন্ডিং/ফিনিশিং", en: "Binding / Finishing" },
      { bn: "ডিজাইন চার্জ", en: "Design Charge" },
    ],
  },
  {
    key: "banner",
    labelKey: "costing.presets.banner",
    categoryNames: [
      { bn: "ফ্লেক্স/ভিনাইল খরচ", en: "Flex / Vinyl Cost" },
      { bn: "প্রিন্টিং চার্জ", en: "Printing Charge" },
      { bn: "ফ্রেম/স্ট্যান্ড খরচ", en: "Frame / Stand Cost" },
      { bn: "ইনস্টলেশন চার্জ", en: "Installation Charge" },
    ],
  },
  {
    key: "card",
    labelKey: "costing.presets.card",
    categoryNames: [
      { bn: "কাগজের খরচ", en: "Paper Cost" },
      { bn: "প্লেট খরচ", en: "Plate Cost" },
      { bn: "প্রিন্টিং চার্জ", en: "Printing Charge" },
      { bn: "লেমিনেশন খরচ", en: "Lamination Cost" },
      { bn: "কাটিং চার্জ", en: "Cutting Charge" },
    ],
  },
  {
    key: "book",
    labelKey: "costing.presets.book",
    categoryNames: [
      { bn: "কাগজের খরচ", en: "Paper Cost" },
      { bn: "প্রিন্টিং চার্জ", en: "Printing Charge" },
      { bn: "বাইন্ডিং খরচ", en: "Binding Cost" },
      { bn: "কভার খরচ", en: "Cover Cost" },
      { bn: "ডিজাইন চার্জ", en: "Design Charge" },
    ],
  },
];
