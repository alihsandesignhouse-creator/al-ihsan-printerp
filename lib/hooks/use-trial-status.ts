import type { Timestamp } from "firebase/firestore";

export type TrialBannerLevel = "info" | "warning" | "danger";

export interface TrialStatus {
  daysLeft: number;
  level: TrialBannerLevel;
  isExpired: boolean;
}

/**
 * Computes days remaining in a trial and the banner urgency level.
 * Per blueprint section 4.1:
 *   3 days left -> blue (info)
 *   2 days left -> blue (info)
 *   1 day left  -> amber (warning)
 *   0 days (today is last day) -> red (danger)
 */
export function computeTrialStatus(trialEndsAt: Timestamp | null): TrialStatus | null {
  if (!trialEndsAt) return null;

  const endDate = trialEndsAt.toDate();
  const now = new Date();

  const msLeft = endDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return { daysLeft: 0, level: "danger", isExpired: msLeft < 0 };
  }
  if (daysLeft === 1) {
    return { daysLeft: 1, level: "warning", isExpired: false };
  }
  return { daysLeft, level: "info", isExpired: false };
}
