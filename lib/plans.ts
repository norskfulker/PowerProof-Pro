/**
 * Plans and limits (Part 6D). The one place to change what Free and Pro include.
 * Both plans pay the same per-sale fees; Pro is $20 a month with the first month free.
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
  /** Connect your own domain (Part 7B) */
  customDomain: boolean;
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

export const PRO_PRICE_USD = 20;
export const PRO_TRIAL_DAYS = 30;

export const PLAN_NAMES: Record<PlanTier, string> = { free: "Free", pro: "Pro" };

export type AllPlanLimits = Record<PlanTier, PlanLimits>;

const count = (n: number | null) => (n === null ? "Unlimited" : String(n));

/** Rows for the Free vs Pro comparison table on /pricing and /settings/billing */
export function planComparison(l: AllPlanLimits): { feature: string; free: string; pro: string }[] {
  return [
    { feature: "Price", free: "$0", pro: `$${PRO_PRICE_USD} a month, first month free` },
    { feature: "Fee per sale", free: "3% (the gateway adds about 2%)", pro: "3% (the gateway adds about 2%)" },
    { feature: "Stores", free: count(l.free.stores), pro: count(l.pro.stores) },
    { feature: "Products", free: count(l.free.products), pro: count(l.pro.products) },
    { feature: "Pages (launch, sale, link in bio)", free: count(l.free.pages), pro: count(l.pro.pages) },
    { feature: "Your own domain (shop.yourname.in)", free: l.free.customDomain ? "Included, with free SSL" : "yourname.powerproof.store", pro: l.pro.customDomain ? "Included, with free SSL" : "yourname.powerproof.store" },
    { feature: "AI image credits each month", free: String(l.free.aiCredits), pro: String(l.pro.aiCredits) },
    { feature: "Deal paths, coupons, bundles", free: "Included", pro: "Included" },
    { feature: "Payouts to your bank: each sale is held 3 hours, then yours to withdraw any time", free: "Included", pro: "Included" },
    { feature: "GST invoices for every order", free: "Included", pro: "Included" },
  ];
}

/** Plain-words list for the Upgrade dialog */
export function proBenefits(l: AllPlanLimits): string[] {
  return ["Unlimited stores, products and pages", "Connect your own domain, with free SSL", `${l.pro.aiCredits} AI image credits a month`, "Same 3% fee per sale, nothing hidden", "Cancel any time from Settings"];
}

/** What one store may keep in its media library. */
export const STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
