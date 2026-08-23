import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1E40AF',
          primaryDeep: '#16307F',
          secondary: '#0EA5E9',
          accent: '#F59E0B',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#3B82F6',
        },
        // Multi-category চার্ট প্যালেট (Pie/Bar-এ ৫+ ক্যাটাগরি দরকার হলে —
        // যেমন যাকাত বিতরণের ৮টা খাত, খরচের কাস্টম ক্যাটাগরি)। ১৭ আগস্ট
        // ২০২৬ অডিট ফিক্স: আগে এই দুইটা রং (`chart.purple`/`chart.pink`)
        // কয়েকটা কম্পোনেন্টে সরাসরি hex হিসেবে হার্ডকোডেড ছিল, কেন্দ্রীয়
        // টোকেন সিস্টেমের বাইরে। এখন এখানে সংজ্ঞায়িত — brand/status
        // টোকেনগুলোর সাথে মিলিয়ে `lib/constants/chart-colors.ts`-এর
        // CHART_PALETTE ব্যবহার করা হয় (single source of truth)।
        chart: {
          purple: '#8B5CF6',
          pink: '#EC4899',
        },
        neutral: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        // ব্যবহারকারীর অনুরোধে (৯ আগস্ট ২০২৬): সাইডবার আগে আলাদা ডার্ক-নেভি
        // ছিল (#1E293B) — brand.primary-তে সরিয়ে আনা হয়েছিল যাতে লগইন
        // পেজ থেকে অ্যাপের ভেতর পর্যন্ত একই নীল প্রধান রং থাকে।
        //
        // পরবর্তী আপডেট (১১ আগস্ট ২০২৬): বড়/লম্বা ফ্ল্যাট এরিয়াতে
        // brand.primary-র মতো vivid রং চোখে অসম/gradient-এর মতো লাগছিল
        // (perceptual area effect — Mach band), যেখানে ছোট এলিমেন্টে
        // (বাটন, আইকন ব্যাজ) একই রং ভালো/জীবন্ত লাগে। তাই সাইডবারের
        // (তেনান্ট + সুপার অ্যাডমিন) জন্য একটু ডিপ ভ্যারিয়েন্ট
        // `primaryDeep` যোগ করা হলো — এটাও এই একই কেন্দ্রীয় জায়গায়
        // সংজ্ঞায়িত, তাই single-source-of-truth নীতি অক্ষুণ্ণ থাকছে।
        // বাটন/লিংক/অ্যাকশন এলিমেন্ট আগের মতোই brand.primary ব্যবহার করবে।
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#1E40AF',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#0EA5E9',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F3F4F6',
          foreground: '#6B7280',
        },
        accent: {
          DEFAULT: '#F59E0B',
          foreground: '#FFFFFF',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        bengali: ['Hind Siliguri', 'Noto Sans Bengali', 'sans-serif'],
        'bengali-body': ['Noto Sans Bengali', 'sans-serif'],
        english: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'Noto Sans Bengali', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
