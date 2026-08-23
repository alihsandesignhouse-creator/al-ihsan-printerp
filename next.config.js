/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      // বাগ-ফিক্স (২১ আগস্ট ২০২৬, অফলাইন গভীর অডিট): networkTimeoutSeconds
      // আগে ১০ সেকেন্ড ছিল — সত্যিকারের অফলাইন অবস্থায় (নেট নেই, স্লো না)
      // অনেক ব্রাউজার/ডিভাইসে এই পুরো ১০ সেকেন্ড অপেক্ষা করেই তারপর
      // cache-এ fallback করত। ইউজারের কাছে এটা "অ্যাপ ফ্রিজ হয়ে গেছে/
      // কাজ করছে না" এর মতো লাগার কথা। ৩ সেকেন্ডে নামানো হলো — নেট
      // সত্যিই না থাকলে দ্রুত cache থেকে দেখাবে, নেট স্লো হলেও ৩ সেকেন্ড
      // যথেষ্ট সময়।
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'firestore-cache',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-images',
        expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // একই ফিক্স — /dashboard ইত্যাদি পেজ-নেভিগেশনেও ১০ সেকেন্ড অপেক্ষা
      // করাচ্ছিল, এখন ৩ সেকেন্ড।
      urlPattern: /^\/(?!api\/).*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'page-cache',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
})

const withNextIntl = require('next-intl/plugin')('./lib/i18n/request.ts')

const nextConfig = {
  reactStrictMode: true,
  images: {
    // firebasestorage.googleapis.com removed — Free Edition no longer uses
    // Firebase Storage (Phase F1 #8: logo upload migrated to Cloudinary).
    domains: ['res.cloudinary.com'],
  },
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
}

module.exports = withPWA(withNextIntl(nextConfig))
