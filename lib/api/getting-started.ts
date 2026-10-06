import { db, getSessionRaw, notifyChange } from "../mock/db";
import { readProgress, writeProgress, type ProgressFlags } from "../mock/progress";
import { PLAN_LIMITS } from "../plans";
import { ApiError, call } from "./client";
import { ownedScopes } from "./scope";
import { isLive } from "../supabase/env";
import { liveFacts } from "./live/progress";

/**
 * Getting-started tracker (Part 6G). Steps are worked out from real data wherever possible
 * (a product exists, a payout method is added, an order is paid), plus a few flags for things
 * the data can't show (email verified, link shared). Optional steps can be skipped.
 */

export type StepId = "verify_email" | "create_store" | "business" | "payout" | "first_product" | "customize" | "publish" | "share" | "first_sale" | "analytics";
export type StepState = "not_started" | "in_progress" | "done" | "skipped";

export interface ChecklistStep {
  id: StepId;
  n: number;
  title: string;
  why: string;
  optional: boolean;
  state: StepState;
  /** Where the Next step button goes */
  href: string;
  /** The element a coach-mark points at when the creator arrives (`data-coach` value) */
  coach: string;
  /** What to do there, for the coach-mark */
  coachText: string;
  /** Short progress note, e.g. "2 of 3 done" */
  detail?: string;
  /** Set when the plan doesn't allow this step yet */
  needsUpgrade?: boolean;
}

export interface Checklist {
  steps: ChecklistStep[];
  percent: number;
  next?: ChecklistStep;
  /** Every required step done; the card can be dismissed */
  complete: boolean;
  dismissed: boolean;
  welcomed: boolean;
  tourSkipped: boolean;
  coachSeen: string[];
}

const DEF: Omit<ChecklistStep, "state" | "href" | "detail" | "n">[] = [
  { id: "verify_email", title: "Verify your email", why: "So buyers' receipts and your payouts reach you.", optional: false, coach: "verify-code", coachText: "Type the 6-digit code from the email we sent." },
  { id: "create_store", title: "Create your store", why: "Pick a name and the link buyers will visit.", optional: false, coach: "store-name", coachText: "Check your store name and link, then save." },
  { id: "business", title: "Add business details", why: "Needed for GST invoices. You can do this later.", optional: true, coach: "company-form", coachText: "Fill in your legal name and address. Skip if you're not registered yet." },
  { id: "payout", title: "Add a payout method", why: "Where your money goes.", optional: false, coach: "add-payout-method", coachText: "Add the bank account (or UPI ID) to send your earnings to." },
  { id: "first_product", title: "Add your first product", why: "The thing you sell.", optional: false, coach: "new-product", coachText: "Pick how you want to add it: upload files, a link, or a page." },
  { id: "customize", title: "Customize your store", why: "Your hero, colours and About page.", optional: false, coach: "design-hero", coachText: "Change the headline and colours, then publish." },
  { id: "publish", title: "Publish your store", why: "Make it visible to buyers.", optional: false, coach: "publish-store", coachText: "Publish to put your store live." },
  { id: "share", title: "Share your link", why: "Buyers can't find a store nobody links to.", optional: false, coach: "share-link", coachText: "Copy your store link and post it where your audience is." },
  { id: "first_sale", title: "Get your first sale", why: "It'll show up here the moment it happens.", optional: false, coach: "share-link", coachText: "Share your link again, or run a launch offer." },
  { id: "analytics", title: "Connect analytics", why: "See where buyers come from. Optional.", optional: true, coach: "integration-google-analytics", coachText: "Paste your Google Analytics ID to start tracking." },
];

/** What the data says about the account; the flags cover the rest. */
interface Facts {
  storeName: string;
  onboarded: boolean;
  anyProduct: boolean;
  draftOnly: boolean;
  paid: boolean;
  analytics: boolean;
  businessFields: number;
  payout: boolean;
  productsFull: boolean;
  email: string;
}

function mockFacts(): Facts {
  const d = db();
  const all = ownedScopes();
  const company = d.company;
  const anyProduct = all.some((x) => x.products.length > 0);
  const tier = d.plan.tier ?? "pro";
  return {
    storeName: d.store.name,
    onboarded: d.store.onboarded,
    anyProduct,
    draftOnly: anyProduct && !all.some((x) => x.products.some((p) => p.status === "published")),
    paid: all.some((x) => x.orders.some((o) => o.status === "paid" || o.status === "refund_requested" || o.status === "refunded")),
    analytics: d.integrations.some((i) => i.connected),
    businessFields: [company.legalName, company.address1, company.city, company.pincode].filter((v) => v?.trim()).length,
    payout: d.payoutMethods.length > 0,
    productsFull: PLAN_LIMITS[tier].products !== null && all.reduce((t, x) => t + x.products.length, 0) >= (PLAN_LIMITS[tier].products ?? Infinity),
    email: getSessionRaw()?.email ?? d.store.ownerEmail,
  };
}

async function facts(): Promise<Facts> {
  if (!isLive()) return mockFacts();
  const f = await liveFacts();
  // Analytics IDs are a browser-only feature for now
  return { ...f, analytics: db().integrations.some((i) => i.connected) };
}

function build(flags: ProgressFlags, f: Facts): Checklist {
  const { anyProduct, draftOnly, paid, analytics, businessFields } = f;
  const c = flags.customized;
  const custom = [c.hero, c.colors, c.about].filter(Boolean).length;

  const state = (id: StepId): [StepState, string?] => {
    if (flags.skipped.includes(id)) return ["skipped"];
    switch (id) {
      case "verify_email":
        return [flags.emailVerified ? "done" : "not_started"];
      case "create_store":
        return [flags.storeConfirmed || f.onboarded ? "done" : f.storeName ? "in_progress" : "not_started"];
      case "business":
        return [businessFields >= 3 ? "done" : businessFields > 0 ? "in_progress" : "not_started"];
      case "payout":
        return [f.payout ? "done" : "not_started"];
      case "first_product":
        return [anyProduct ? "done" : "not_started", draftOnly ? "Saved as a draft" : undefined];
      case "customize":
        return [custom === 3 ? "done" : custom > 0 ? "in_progress" : "not_started", `${custom} of 3: hero, colours, About`];
      case "publish":
        return [f.onboarded ? "done" : "not_started"];
      case "share":
        return [flags.shared ? "done" : "not_started"];
      case "first_sale":
        return [paid ? "done" : flags.shared ? "in_progress" : "not_started", paid ? undefined : flags.shared ? "Waiting for your first buyer" : undefined];
      case "analytics":
        return [analytics ? "done" : "not_started"];
    }
  };

  const email = f.email;
  const href: Record<StepId, string> = {
    verify_email: `/verify-email?email=${encodeURIComponent(email)}`,
    create_store: "/store/current/settings",
    business: "/settings/company",
    payout: "/sales/payouts/methods",
    first_product: "/catalog/products/new",
    customize: "/store/current/design/backgrounds",
    publish: "/store/current/design/theme",
    share: "/dashboard",
    first_sale: "/dashboard",
    analytics: "/tools/integrations",
  };
  const productsFull = f.productsFull;

  const steps: ChecklistStep[] = DEF.map((def, i) => {
    const [st, detail] = state(def.id);
    return { ...def, n: i + 1, state: st, detail, href: `${href[def.id]}${href[def.id].includes("?") ? "&" : "?"}coach=${def.id}`, needsUpgrade: def.id === "first_product" && st !== "done" && productsFull ? true : undefined };
  });
  const finished = steps.filter((x) => x.state === "done" || x.state === "skipped").length;
  const complete = steps.every((x) => x.state === "done" || x.state === "skipped" || x.optional);
  return {
    steps,
    percent: Math.round((finished / steps.length) * 100),
    next: steps.find((x) => x.state !== "done" && x.state !== "skipped"),
    complete,
    dismissed: flags.dismissed && complete,
    welcomed: flags.welcomed,
    tourSkipped: flags.tourSkipped,
    coachSeen: flags.coachSeen,
  };
}

export function getChecklist(): Promise<Checklist> {
  return call(async () => build(readProgress(), await facts()), { fast: true });
}

/** Records something the data can't show by itself, then tells every screen to refresh. */
export function recordProgress(patch: Partial<ProgressFlags> | ((p: ProgressFlags) => Partial<ProgressFlags>)) {
  writeProgress(patch);
  notifyChange();
}

export function skipStep(id: StepId, skip = true): Promise<Checklist> {
  return call(async () => {
    const def = DEF.find((x) => x.id === id);
    if (!def?.optional) throw new ApiError("Only optional steps can be skipped.", "validation");
    recordProgress((p) => ({ skipped: skip ? [...new Set([...p.skipped, id])] : p.skipped.filter((x) => x !== id) }));
    return build(readProgress(), await facts());
  }, { fast: true });
}

export function dismissChecklist(dismissed = true): Promise<Checklist> {
  return call(async () => {
    const f = await facts();
    const now = build(readProgress(), f);
    if (dismissed && !now.complete) throw new ApiError("Finish the required steps first. Optional ones can be skipped.", "conflict");
    recordProgress({ dismissed });
    return build(readProgress(), f);
  }, { fast: true });
}

export function markWelcomed(): Promise<void> {
  return call(() => recordProgress({ welcomed: true }), { fast: true });
}

export function markCoachSeen(id: string, skipTour = false): Promise<void> {
  return call(() => recordProgress((p) => ({ coachSeen: [...new Set([...p.coachSeen, id])], tourSkipped: p.tourSkipped || skipTour })), { fast: true });
}

/** Called wherever the creator copies or shares their store link. */
export function markLinkShared(): void {
  recordProgress({ shared: true });
}
