/**
 * lib/constants/chart-colors.ts
 *
 * মাল্টি-ক্যাটাগরি Pie/Bar চার্টের রঙের একক কেন্দ্রীয় উৎস (audit ফিক্স,
 * ১৭ আগস্ট ২০২৬)। আগে `zakat-distribution-section.tsx` ও
 * `expense-analysis-section.tsx` — দুই জায়গায় হুবহু একই ৮-রঙের হেক্স
 * অ্যারে আলাদাভাবে ডুপ্লিকেট করা ছিল, এবং শেষ তিনটা রং (`#8B5CF6`
 * বেগুনি, `#EC4899` গোলাপি, `#6B7280` ধূসর) `tailwind.config.ts`-এর
 * কেন্দ্রীয় ডিজাইন-টোকেন সিস্টেমের বাইরে ছিল।
 *
 * এখন প্রথম ৫টা রং বিদ্যমান `brand`/`status` টোকেন থেকে, আর `chart.purple`/
 * `chart.pink` টোকেন দুটো `tailwind.config.ts`-এ নতুন করে যোগ করা হয়েছে —
 * তাই পুরো প্যালেট এখন সম্পূর্ণভাবে কেন্দ্রীয় টোকেন সিস্টেমের অংশ।
 * `lib/constants/status-colors.ts`-এর মতোই — কোনো চার্ট-রং বদলাতে হলে
 * এখন থেকে শুধু এই একটা ফাইল (ও সংশ্লিষ্ট tailwind.config.ts এন্ট্রি)
 * এডিট করলেই চলবে।
 *
 * Recharts-এর `<Cell fill={...}>` SVG attribute-এ সরাসরি Tailwind class
 * ব্যবহার করা যায় না (SVG fill CSS ক্লাস দিয়ে কাজ করে না এই setup-এ),
 * তাই raw hex রাখা হয়েছে — কিন্তু প্রতিটা মান tailwind.config.ts-এর
 * টোকেনের সাথে হুবহু মিলিয়ে রাখা, কমেন্টে উৎস উল্লেখ করা আছে।
 */

export const CHART_PALETTE: readonly string[] = [
  "#1E40AF", // brand.primary
  "#0EA5E9", // brand.secondary
  "#F59E0B", // brand.accent / status.warning
  "#10B981", // status.success
  "#EF4444", // status.danger
  "#8B5CF6", // chart.purple
  "#EC4899", // chart.pink
  "#6B7280", // neutral.500
] as const;
