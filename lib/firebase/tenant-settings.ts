import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "./client";
import { logAction } from "./audit";
import type { GeneralSettingsFormValues, BusinessSettingsFormValues, NotificationSettingsFormValues } from "@/lib/validations/tenant-settings";

const tenantDoc = (tenantId: string) => doc(db, "tenants", tenantId);

export async function updateGeneralSettings(
  tenantId: string,
  data: GeneralSettingsFormValues
): Promise<void> {
  await updateDoc(tenantDoc(tenantId), {
    name: data.name.trim(),
    address: data.address.trim(),
    invoiceFooterMessage: data.invoiceFooterMessage.trim(),
    updatedAt: Timestamp.now(),
  });
  void logAction(tenantId, "settings.general_updated", "tenant_settings", tenantId, {
    name: data.name.trim(),
  });
}

export async function updateBusinessSettings(
  tenantId: string,
  data: BusinessSettingsFormValues
): Promise<void> {
  await updateDoc(tenantDoc(tenantId), {
    orderIdPrefix: data.orderIdPrefix.trim().toUpperCase(),
    "settings.defaultCommissionRate": data.defaultCommissionRate,
    "settings.defaultDeliveryDays": data.defaultDeliveryDays,
    "settings.currency": data.currency.trim(),
    updatedAt: Timestamp.now(),
  });
  void logAction(tenantId, "settings.business_updated", "tenant_settings", tenantId, {
    orderIdPrefix: data.orderIdPrefix.trim().toUpperCase(),
    defaultCommissionRate: data.defaultCommissionRate,
    defaultDeliveryDays: data.defaultDeliveryDays,
    currency: data.currency.trim(),
  });
}

export async function updateNotificationTemplates(
  tenantId: string,
  data: NotificationSettingsFormValues
): Promise<void> {
  await updateDoc(tenantDoc(tenantId), {
    notificationTemplates: data,
    updatedAt: Timestamp.now(),
  });
  void logAction(tenantId, "settings.notifications_updated", "tenant_settings", tenantId, {});
}

/**
 * Shape of the fields we read from Cloudinary's unsigned upload response.
 * Cloudinary returns many more fields; we only assert the one we use.
 */
interface CloudinaryUploadResponse {
  secure_url: string;
}

function isCloudinaryUploadResponse(value: unknown): value is CloudinaryUploadResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "secure_url" in value &&
    typeof (value as { secure_url: unknown }).secure_url === "string" &&
    (value as { secure_url: string }).secure_url.length > 0
  );
}

/**
 * Uploads a tenant logo image directly from the browser to Cloudinary using
 * an UNSIGNED upload preset (Free Edition / Firebase Spark plan has no
 * Cloud Storage — see MODULE_README.md "Free Edition — Phase F1 #8").
 *
 * Requires NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
 * NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to be set (see .env.local.example
 * and DEPLOYMENT-CHECKLIST.md section 1.4).
 *
 * IMPORTANT — no server-side enforcement: unlike the old storage.rules
 * (2MB max, image/* only, tenant_admin only), an unsigned Cloudinary preset
 * cannot verify the caller's Firebase Auth role or tenantId, and file
 * size/type limits configured on the preset are a courtesy, not a hard
 * guarantee against a determined client bypassing this function entirely
 * and calling the Cloudinary endpoint directly with different field values.
 * Client-side validation (file type + 2MB size check) is therefore done in
 * the calling form component (see
 * components/tenant/settings/general-settings-form.tsx) as the first line
 * of defense, and the Cloudinary preset itself should additionally be
 * configured (in the Cloudinary console) with: allowed formats restricted
 * to image types, a max file size of 2MB, and "Use filename or externally
 * defined Public ID" left off so Cloudinary generates unique public IDs.
 * This is a documented, accepted trade-off of the unsigned-upload pattern
 * for a card-free, backend-free Free Edition — it is not a regression from
 * a security posture Free Edition ever actually had in production (Spark
 * plan cannot run Cloud Storage regardless).
 *
 * The tenantId is only used to namespace the Cloudinary folder for human
 * browsability in the Cloudinary console — it is not a security boundary.
 *
 * On success, mirrors the resulting secure URL onto the tenant document's
 * `logoUrl` field, exactly as the previous Firebase Storage implementation
 * did, so every other place that reads `logoUrl` (delivery challan,
 * quotation print view, customer portal invoice view) needs no changes.
 */
export async function uploadTenantLogo(tenantId: string, file: File): Promise<string> {
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
  formData.append("folder", `tenants/${tenantId}/logo`);

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

  await updateDoc(tenantDoc(tenantId), {
    logoUrl: url,
    updatedAt: Timestamp.now(),
  });

  void logAction(tenantId, "settings.logo_updated", "tenant_settings", tenantId, { logoUrl: url });

  return url;
}
