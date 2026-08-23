/**
 * components/shared/brand-logo.tsx
 *
 * প্রিমিয়াম auth-পেজ রিডিজাইন (৯ আগস্ট ২০২৬)। Super Admin SA-05
 * "যোগাযোগ" ট্যাব থেকে একটা আসল লোগো (`platformSettings.logoUrl`)
 * আপলোড করার আগ পর্যন্ত এই কম্পোনেন্ট একটা ডিজাইন করা SVG মনোগ্রাম
 * fallback দেখায় — logoUrl সেট হওয়ার সাথে সাথে কোনো কোড পরিবর্তন ছাড়াই
 * স্বয়ংক্রিয়ভাবে আসল ছবিতে বদলে যাবে (দেখুন lib/firebase/platform-settings.ts-এর
 * uploadPlatformLogo())।
 *
 * SVG fallback ডিজাইন: brand-primary রঙের একটা রাউন্ডেড-স্কয়ার প্লেট,
 * ভেতরে সাদা রঙে স্টাইলাইজড "চালান/পেজ" শেপ (দুটো কোণা-ভাঁজ করা কাগজ,
 * প্রিন্টিং-প্রেস ব্যবসার সাথে সঙ্গতিপূর্ণ) — কোনো বাহ্যিক ছবি ছাড়াই
 * ভেক্টর, তাই যেকোনো সাইজে ঝকঝকে।
 */

interface BrandLogoProps {
  logoUrl?: string;
  /** px — বর্গাকার আকারের একটা সাইড। */
  size?: number;
  className?: string;
}

export function BrandLogoMark({ logoUrl, size = 40, className = "" }: BrandLogoProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt="AL-IHSAN PrintERP"
        width={size}
        height={size}
        className={`shrink-0 rounded-xl object-contain ${className}`}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="AL-IHSAN PrintERP"
    >
      <rect width="40" height="40" rx="11" fill="#1E40AF" />
      <rect width="40" height="40" rx="11" fill="url(#brand-logo-sheen)" fillOpacity="0.5" />
      {/* স্টাইলাইজড দুটো কাগজ/চালান — একটা পেছনে অফসেট করা, প্রিন্টিং-প্রেসের রেফারেন্স */}
      <rect x="12.5" y="9" width="13" height="17" rx="1.6" fill="#FFFFFF" fillOpacity="0.35" />
      <rect x="10" y="12" width="15" height="19" rx="1.8" fill="#FFFFFF" />
      <path d="M13.4 16.2h8.2M13.4 19.6h8.2M13.4 23h5.4" stroke="#1E40AF" strokeWidth="1.6" strokeLinecap="round" />
      <defs>
        <linearGradient id="brand-logo-sheen" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8FC5FF" />
          <stop offset="1" stopColor="#8FC5FF" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface BrandLogoLockupProps extends BrandLogoProps {
  /** লোগো মার্কের পাশে নাম/ট্যাগলাইন দেখাবে কিনা। */
  showWordmark?: boolean;
  /** wordmark-এর টেক্সট রং — ডার্ক ব্যাকগ্রাউন্ডে "light", হালকা ব্যাকগ্রাউন্ডে "dark"। */
  tone?: "light" | "dark";
}

/** মনোগ্রাম + "AL-IHSAN PrintERP" ওয়ার্ডমার্ক — auth পেজের হেডারে ব্যবহারের জন্য। */
export function BrandLogoLockup({
  logoUrl,
  size = 40,
  showWordmark = true,
  tone = "dark",
  className = "",
}: BrandLogoLockupProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BrandLogoMark logoUrl={logoUrl} size={size} />
      {showWordmark && (
        <div className="min-w-0">
          <p className={`text-base font-bold leading-tight ${tone === "light" ? "text-white" : "text-neutral-900"}`}>
            AL-IHSAN PrintERP
          </p>
          <p className={`text-[11px] leading-tight ${tone === "light" ? "text-white/70" : "text-neutral-500"}`}>
            প্রিন্টিং প্রেস ম্যানেজমেন্ট সফটওয়্যার
          </p>
        </div>
      )}
    </div>
  );
}
