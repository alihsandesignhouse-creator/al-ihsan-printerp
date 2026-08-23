import { doc, getDoc, onSnapshot, setDoc, Timestamp, type Unsubscribe } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/lib/types/platform-settings";
import type { PlatformContactSettingsFormValues } from "@/lib/validations/platform-settings";
/**
 * lib/firebase/platform-settings.ts — SA-05, contact-settings tab.
 *
 * `/platform_settings/general` is a singleton document. Reads fall back to
 * DEFAULT_PLATFORM_SETTINGS when the document hasn't been created yet
 * (mirrors lib/firebase/subscription-plans.ts's per-plan fallback), so the
 * four public pages that consume this never see an empty/undefined value —
 * behavior is identical to the previously-hardcoded constants until a
 * Super Admin explicitly saves a change here.
 */
const settingsDocRef = () => doc(db, "platform_settings", "general");

/** One-time fetch — used by the four public-facing pages (login,
 *  trial-expired, suspended, tenant layout's trial banner). No auth
 *  required (firestore.rules: `match /platform_settings/{docId} { allow
 *  read: if true; }`, same shape as `/subscription_plans`). */
export async function getPlatformSettingsOnce(): Promise<PlatformSettings> {
  const snap = await getDoc(settingsDocRef());
  if (!snap.exists()) return DEFAULT_PLATFORM_SETTINGS;
  return { ...DEFAULT_PLATFORM_SETTINGS, ...snap.data() } as PlatformSettings;
}

/** Live subscription — used by the SA-05 contact-settings form so a second
 *  super admin's edit (another browser tab/session) is reflected without
 *  a manual refresh. */
export function subscribePlatformSettings(
  onData: (settings: PlatformSettings) => void,
  onError: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    settingsDocRef(),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_PLATFORM_SETTINGS);
        return;
      }
      onData({ ...DEFAULT_PLATFORM_SETTINGS, ...snap.data() } as PlatformSettings);
    },
    onError
  );
}

/**
 * Super-Admin-only write (enforced by firestore.rules' blanket
 * `{document=**}` super_admin rule — no separate rule block needed, same
 * as every other Super Admin write in this module, e.g.
 * updateSubscriptionPlan). `setDoc` with `merge: true` so the very first
 * save creates the document without needing a separate seed step.
 */
export async function updatePlatformContactSettings(
  data: PlatformContactSettingsFormValues
): Promise<void> {
  const currentUser = auth.currentUser;
  await setDoc(
    settingsDocRef(),
    {
      supportPhone: data.supportPhone.trim(),
      whatsappPhone: data.whatsappPhone.trim(),
      supportEmail: data.supportEmail.trim(),
      updatedAt: Timestamp.now(),
      updatedBy: currentUser?.uid ?? "",
    },
    { merge: true }
  );
}

/**
 * প্রিমিয়াম auth-পেজ রিডিজাইন (৯ আগস্ট ২০২৬) — লগইন/সাইনআপ/ফরগট-পাসওয়ার্ড
 * পেজের জন্য প্ল্যাটফর্ম-লেভেল লোগো আপলোড। `lib/firebase/tenant-settings.ts`-এর
 * `uploadTenantLogo()`-এর হুবহু একই Cloudinary unsigned-upload প্যাটার্ন
 * (আলাদা কারণ: এই ফাইলটা `tenants/{tenantId}` না, `platform_settings/general`
 * singleton ডকুমেন্ট নিয়ে কাজ করে বলে সেই ফাংশনটা সরাসরি পুনর্ব্যবহার করা
 * যায়নি — কিন্তু আচরণ, নিরাপত্তা-সীমাবদ্ধতা, আর ট্রেড-অফ সব একই)।
 *
 * নিরাপত্তা নোট (uploadTenantLogo()-এর মতোই): unsigned Cloudinary preset
 * caller-এর super_admin রোল যাচাই করতে পারে না — client-side ফাইল
 * টাইপ/সাইজ চেক (দেখুন LogoUploadField) প্রথম প্রতিরক্ষা স্তর মাত্র,
 * Cloudinary console-এ preset-এর নিজস্ব ফরম্যাট/সাইজ সীমাও কনফিগার করা
 * উচিত। এটা Free Edition-এর card-free/backend-free আর্কিটেকচারের একটা
 * ডকুমেন্টেড, গৃহীত ট্রেড-অফ — Firebase Storage Spark প্ল্যানে চলে না
 * বলেই এই পথ।
 */
interface CloudinaryUploadResponse {
  secure_url: string;
}

function isCloudinaryUploadResponse(value: unknown): value is CloudinaryUploadResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "secure_url" in value &&
    typeof (value as { secure_url: unknown }).secure_url === "string"
  );
}

export async function uploadPlatformLogo(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary কনফিগারেশন পাওয়া যায়নি — NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ও NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET সেট করা আছে কিনা যাচাই করুন"
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "platform/logo");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Cloudinary আপলোড ব্যর্থ হয়েছে (status ${response.status})`);
  }

  const data: unknown = await response.json();
  if (!isCloudinaryUploadResponse(data)) {
    throw new Error("Cloudinary থেকে অপ্রত্যাশিত রেসপন্স পাওয়া গেছে (secure_url অনুপস্থিত)");
  }

  const url = data.secure_url;
  const currentUser = auth.currentUser;

  await setDoc(
    settingsDocRef(),
    {
      logoUrl: url,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser?.uid ?? "",
    },
    { merge: true }
  );

  return url;
}
