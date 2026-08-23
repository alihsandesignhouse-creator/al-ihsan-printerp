/**
 * Cloud Functions entry point.
 *
 * Resolved in this session: the project previously had no index.ts and
 * contained two competing implementations of onTenantSelfSignup and
 * checkTrialExpiry (a v1-SDK version in tenantFunctions.ts, and a v2-SDK
 * version in separate files). The v2 versions were deleted because their
 * planFeatures used "advancedAnalytics" instead of the client's actual
 * PlanFeatures key "advancedReports" and ran in the wrong region
 * (asia-southeast1 instead of asia-south1 per blueprint section 2.1).
 * tenantFunctions.ts is now the single source of truth for tenant lifecycle
 * functions.
 */
export {
  onAdminCreateTenant,
  onTenantSelfSignup,
  checkTrialExpiry,
  onTenantActivated,
} from "./tenantFunctions";

export { generateOrderNumber } from "./orderFunctions";

export { generateQuotationNumber, checkQuotationExpiry } from "./quotationFunctions";

// Module T-07 (ব্যবহারকারী ব্যবস্থাপনা) — these were implemented in
// userFunctions.ts but never re-exported here, so they were never deployed.
// The client (lib/firebase/users.ts → staff-form-modal.tsx,
// toggle-staff-active-dialog.tsx) has been calling these callable names all
// along; exporting them is the only change needed to make T-07 functional.
export {
  onCreateStaffMember,
  onUpdateStaffMember,
  onSetStaffActiveStatus,
} from "./userFunctions";

// Module T-19.5 (In-App নোটিফিকেশন, blueprint ১৪.১০) — event-driven (নতুন
// অর্ডার, স্টক কম) ও scheduled দৈনিক ডাইজেস্ট (আজকের ডেলিভারি, বকেয়া সতর্কতা)।
export {
  notifyOnNewOrder,
  notifyOnLowStock,
  sendDailyNotifications,
} from "./notificationFunctions";

// Module T-20 (গ্রাহক পোর্টাল, প্রিমিয়াম) — পাবলিক, লগইন-বিহীন অর্ডার
// ট্র্যাকিং। onRequest (onCall নয়) — app/api/portal/track/route.ts থেকে
// fetch() দিয়ে কল হয়, onTenantSelfSignup-এর প্যাটার্নের মতো।
export { getPortalOrderStatus } from "./portalFunctions";
