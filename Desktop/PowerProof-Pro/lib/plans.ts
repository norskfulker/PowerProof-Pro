/**
 * Plans and limits (Part 6D). The one place to change what Free and Pro include.
 * Both plans pay the same per-sale fees; Pro is ₹1,999 a month with the first month free.
 * Billing is INR-only and card-upfront: the trial starts after Razorpay token auth.
 */

export type PlanTier = "free" | "pro";

export interface PlanLimits {
  /** null = unlimited */
  stores: number | null;
  products: number | null;
  /** Pages built in the visual editor (Launch, Sale, Link in bio…) */
  pages: number | null;
  /** AI image credits per calendar month; one generation of 4 variations costs 1 credit */
  aiCredits: number;
  /** Pages AI may build per day (India time); a failed run doesn't count */
  aiPagesDaily: number;
  /** People a store can invite to its team, not counting the owner; null = unlimited */
  teamSeats: number | null;
}

/** What each AI action costs, in credits */
export const AI_COSTS = {
  generate: 1,
  regenerate: 1,
  vary: 1,
  edit: 1,
  removeBackground: 1,
  upscale: 1,
} as const;

export const PRO_PRICE_INR = 1999;
export const PRO_PRICE_MINOR = 199900;
export const PRO_TRIAL_DAYS = 30;

/** When a Pro trial ends (card authorised now, first charge then). Pure and unit-tested. */
export const trialEndsAt = (from = new Date()): Date =>
  new Date(from.getTime() + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000);

/** Free AI chat messages per creator (lifetime; failed runs don't count). Pro builds 10 pages a day. */
export const AI_FREE_MESSAGES = 100;

export const PLAN_NAMES: Record<PlanTier, string> = { free: "Free", pro: "Pro" };

export type AllPlanLimits = Record<PlanTier, PlanLimits>;

/** Plain-words list for the Upgrade dialog */
export function proBenefits(l: AllPlanLimits): string[] {
  return ["Unlimited stores, products and pages", `${l.pro.aiCredits} AI image credits a month`, l.pro.teamSeats === null ? "As many team members as you need" : `Up to ${l.pro.teamSeats} team members`, "Same 3% fee per sale, nothing hidden", "Cancel any time from Settings"];
}

/** What one store may keep in its media library. */
export const STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
