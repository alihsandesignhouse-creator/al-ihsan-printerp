import { Timestamp } from "firebase/firestore";

/**
 * lib/types/platform-settings.ts — Module SA-05 (সিস্টেম সেটিং), contact tab.
 *
 * Firestore doc: `/platform_settings/general` — a single top-level
 * singleton document (not tenant-scoped). Replaces the `CONTACT_PHONE` /
 * `TRIAL_CONTACT_PHONE` constants that were previously hardcoded and
 * duplicated in four places: app/(auth)/login/page.tsx,
 * app/trial-expired/page.tsx, app/suspended/page.tsx, and
 * app/(tenant)/layout.tsx. Now a single Super-Admin-editable source of
 * truth that all four pages read via getPlatformSettingsOnce().
 *
 * Access (firestore.rules): public read (unauthenticated — the login page
 * itself is public, so this cannot require isSignedIn()), write restricted
 * to super_admin via the existing blanket `{document=**}` rule — the same
 * shape as `/subscription_plans` (see that block's comment).
 */
export interface PlatformSettings {
  /** Shown as "01XXXXXXXXX" and used for tel: links. */
  supportPhone: string;
  /** Used for the wa.me/ deep link on /trial-expired. Often identical to supportPhone. */
  whatsappPhone: string;
  supportEmail: string;
  /**
   * প্রিমিয়াম লগইন/সাইনআপ/ফরগট-পাসওয়ার্ড রিডিজাইন (৯ আগস্ট ২০২৬) — খালি
   * থাকলে এই পেজগুলো `components/shared/brand-logo.tsx`-এর বিল্ট-ইন SVG
   * মনোগ্রাম ব্যবহার করে (কোনো আসল লোগো ফাইল ছাড়াই কাজ করার জন্য)। Super
   * Admin SA-05 "যোগাযোগ" ট্যাব থেকে আসল লোগো আপলোড করলে (Cloudinary,
   * tenant logo upload-এর একই প্যাটার্নে — দেখুন
   * uploadPlatformLogo()) এখানে সেট হয় এবং সাথে সাথে SVG-এর বদলে সেই
   * ছবিটাই দেখাবে — কোড পরিবর্তনের দরকার নেই।
   */
  logoUrl: string;
  updatedAt: Timestamp | null;
  /** Super Admin uid that last saved this document — "" if never edited. */
  updatedBy: string;
}

/**
 * Fallback used both by getPlatformSettingsOnce()/subscribePlatformSettings()
 * (before any Super Admin has ever saved the document) and as the initial
 * form values on the SA-05 contact-settings form — matches the values that
 * were previously hardcoded across the four public-facing pages above, so
 * behavior is unchanged until a Super Admin explicitly edits it.
 */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  // "নির্মাতার পরিচিতি" পেজে Trial-contact ব্লক যোগ (১৪ আগস্ট ২০২৬) — এই তিনটি
  // মান আসল প্রতিষ্ঠাতার প্রকৃত যোগাযোগ তথ্যে আপডেট করা হলো (placeholder
  // 01700000000 / info@printsaas.com.bd-এর বদলে) যাতে login/signup/
  // trial-expired/suspended/tenant-layout ট্রায়াল-ব্যানার ও নতুন
  // components/shared/about-content.tsx — সবাই একই সিঙ্গেল-সোর্স-অফ-ট্রুথ
  // থেকে সঠিক নম্বর/ইমেইল দেখায়। যদি Super Admin ইতিমধ্যে
  // `/platform_settings/general` ডকুমেন্ট নিজে সেভ করে থাকেন, সেই মানই
  // অগ্রাধিকার পাবে (এই DEFAULT শুধু ডকুমেন্ট তৈরির আগ পর্যন্ত ফলব্যাক)।
  supportPhone: "01752564338",
  whatsappPhone: "01752564338",
  supportEmail: "alihsanprinterp@gmail.com",
  logoUrl: "",
  updatedAt: null,
  updatedBy: "",
};
