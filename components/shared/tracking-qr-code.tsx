"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";

interface TrackingQrCodeProps {
  tenantId: string;
  orderNumber: string;
  /** px, square — kept small enough not to dominate a printed A4/receipt layout. */
  size?: number;
}

/**
 * Phase 3 আইটেম #৩৩ (blueprint): "QR কোড (চালানে)"।
 *
 * চালান/কোটেশনে একটা QR কোড বসানো হয় যা `/portal/{tenantId}?order=...`-এ
 * নিয়ে যায় — T-20 গ্রাহক পোর্টালের (blueprint: "অর্ডার নম্বর দিয়ে ট্র্যাকিং,
 * লগইন ছাড়াও") একটা শর্টকাট। ইচ্ছাকৃতভাবে শুধু `orderNumber` এনকোড করা হয়,
 * কাস্টমারের ফোন নম্বর নয় — পোর্টাল লুকআপ এখনো ফোন নম্বর টাইপ করে ভেরিফাই
 * করা লাগে (`lib/validations/portal.ts`), তাই QR স্ক্যান করলে শুধু অর্ডার
 * নম্বর ফিল্ড prefill হয়, কোনো প্রাইভেট ডেটা QR কোডে এনকোড/লিক হয় না।
 *
 * `<img>` + data URL ব্যবহার করা হয়েছে (canvas নয়) — প্রিন্ট আউটে `<canvas>`
 * রেন্ডারিং কিছু ব্রাউজারে অনির্ভরযোগ্য, রাস্টারাইজড data URL
 * `window.print()`-এ নির্ভরযোগ্যভাবে দেখা যায় (delivery-challan.tsx ও
 * quotation-print-view.tsx-এর বিদ্যমান window.print() প্যাটার্নের সাথে
 * সামঞ্জস্যপূর্ণ)।
 *
 * `window.location.origin` রানটাইমে পড়া হয় (build-time env var নয়) যাতে
 * dev/staging/production — যেকোনো ডোমেইনে সঠিক লিংক তৈরি হয়।
 */
export function TrackingQrCode({ tenantId, orderNumber, size = 88 }: TrackingQrCodeProps) {
  const t = useTranslations();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !tenantId || !orderNumber) return;

    const trackingUrl = `${window.location.origin}/portal/${tenantId}?order=${encodeURIComponent(orderNumber)}`;
    let cancelled = false;

    QRCode.toDataURL(trackingUrl, { width: size * 3, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        // Offline or generation failure — silently omit the QR rather than
        // block challan/quotation printing over a non-essential extra.
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, orderNumber, size]);

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a static/remote asset next/image can optimize */}
      <img src={dataUrl} alt="" aria-hidden="true" width={size} height={size} />
      <p className="max-w-[100px] text-center text-[10px] leading-tight text-neutral-400">
        {t("orders.scanToTrack")}
      </p>
    </div>
  );
}
