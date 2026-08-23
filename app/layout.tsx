import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'AL-IHSAN PrintERP — প্রিন্টিং ব্যবস্থাপনা',
    template: '%s | AL-IHSAN PrintERP',
  },
  description: 'প্রিন্টিং প্রেসের সম্পূর্ণ ব্যবস্থাপনা সফটওয়্যার',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AL-IHSAN PrintERP',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    shortcut: '/icons/icon-96.png',
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#1E40AF',
  width: 'device-width',
  initialScale: 1,
  // বাগ-ফিক্স (২১ আগস্ট ২০২৬, মোবাইল-রেসপন্সিভ অডিট): PWA "standalone"
  // মোডে (manifest.json দ্রষ্টব্য) viewportFit: "cover" ছাড়া
  // env(safe-area-inset-*) CSS ভ্যারিয়েবল সবসময় ০ থাকে — নিচের ফিক্সড
  // bottom-nav-এর safe-area padding তাই এটা ছাড়া কোনো প্রভাব ফেলত না।
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Bengali fonts from Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AL-IHSAN PrintERP" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-neutral-50`}>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
