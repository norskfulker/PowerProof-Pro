import { ApiError } from "./client";
import { readProgress, writeProgress, type ProgressFlags } from "./live/flags";
import { notifyChange } from "./live/local";
import { liveFacts } from "./live/progress";

/**
 * Getting-started tracker (Part 6G). Steps are worked out from real data wherever possible
 * (a product exists, a payout method is added, an order is paid), plus a few flags for things
 * the data can't show (email verified, link shared). Optional steps can be skipped.
 */

export type StepId = "verify_email" | "collections" | "business" | "payout" | "first_product" | "customize" | "publish" | "share" | "first_sale" | "analytics";
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

/** In the order of the business flow: Collections, Products, Sales, Orders, Payouts, then the rest. */
const DEF: Omit<ChecklistStep, "state" | "href" | "detail" | "n">[] = [
  { id: "verify_email", title: "Verify your email", why: "So buyers' receipts and your payouts reach you.", optional: false, coach: "verify-code", coachText: "Type the 6-digit code from the email we sent." },
  { id: "collections", title: "Group products into collections", why: "Optional. Collections just help organize products; you can sell without one.", optional: true, coach: "new-collection", coachText: "Name a collection and pick a colour or image for its tile." },
  { id: "first_product", title: "Add your first product", why: "The thing you sell.", optional: false, coach: "new-product", coachText: "Upload the file, then name it and set a price." },
  { id: "publish", title: "Publish your store", why: "Make it visible to buyers.", optional: false, coach: "publish-store", coachText: "Publish to put your store live." },
  { id: "share", title: "Share your link", why: "Buyers can't find a store nobody links to.", optional: false, coach: "share-link", coachText: "Copy your store link and post it where your audience is." },
  { id: "first_sale", title: "Get your first sale", why: "It'll show up under Sales › Orders the moment it happens.", optional: false, coach: "share-link", coachText: "Share your link again, or run a launch offer." },
  { id: "payout", title: "Add a payout method", why: "Where your money goes.", optional: false, coach: "add-payout-method", coachText: "Add the bank account (or UPI ID) to send your earnings to." },
  { id: "customize", title: "Customize your store", why: "Your colour, fonts and pages.", optional: false, coach: "design-hero", coachText: "Pick your brand colour and fonts, then build a page." },
  { id: "business", title: "Add business details", why: "Needed for GST invoices. You can do this later.", optional: true, coach: "company-form", coachText: "Fill in your legal name and address. Skip if you're not registered yet." },
  { id: "analytics", title: "Connect analytics", why: "See where buyers come from. Optional.", optional: true, coach: "integration-google-analytics", coachText: "Paste your Google Analytics ID to start tracking." },
];

/** What the data says about the account; the flags cover the rest. */
interface Facts {
  storeName: string;
  onboarded: boolean;
  anyProduct: boolean;
  anyCollection: boolean;
  draftOnly: boolean;
  paid: boolean;
  analytics: boolean;
  businessFields: number;
  payout: boolean;
  productsFull: boolean;
  email: string;
}

const facts = (): Promise<Facts> => liveFacts();

function build(flags: ProgressFlags, f: Facts): Checklist {
  const { anyProduct, draftOnly, paid, analytics, businessFields } = f;
  const c = flags.customized;
  const custom = [c.hero, c.colors, c.about].filter(Boolean).length;

  const state = (id: StepId): [StepState, string?] => {
    if (flags.skipped.includes(id)) return ["skipped"];
    switch (id) {
      case "verify_email":
        return [flags.emailVerified ? "done" : "not_started"];
      case "collections":
        return [f.anyCollection ? "done" : "not_started"];
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
    collections: "/catalog/collections",
    business: "/settings/company",
    payout: "/sales/payouts/methods",
    first_product: "/catalog/products/new",
    customize: "/store/current/design/pages/home/edit",
    publish: "/store/current/design/pages/home/edit",
    share: "/dashboard",
    first_sale: "/dashboard",
    analytics: "/tools/integrations",
  };
  const productsFull = f.productsFull;

  const defs = DEF;
  const steps: ChecklistStep[] = defs.map((def, i) => {
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

export async function getChecklist(): Promise<Checklist> {
  return build(readProgress(), await facts());
}

/** Records something the data can't show by itself, then tells every screen to refresh. */
export function recordProgress(patch: Partial<ProgressFlags> | ((p: ProgressFlags) => Partial<ProgressFlags>)) {
  writeProgress(patch);
  notifyChange();
}

export async function skipStep(id: StepId, skip = true): Promise<Checklist> {
  const def = DEF.find((x) => x.id === id);
  if (!def?.optional) throw new ApiError("Only optional steps can be skipped.", "validation");
  recordProgress((p) => ({ skipped: skip ? [...new Set([...p.skipped, id])] : p.skipped.filter((x) => x !== id) }));
  return build(readProgress(), await facts());
}

export async function dismissChecklist(dismissed = true): Promise<Checklist> {
  const f = await facts();
  const now = build(readProgress(), f);
  if (dismissed && !now.complete) throw new ApiError("Finish the required steps first. Optional ones can be skipped.", "conflict");
  recordProgress({ dismissed });
  return build(readProgress(), f);
}

export async function markWelcomed(): Promise<void> {
  recordProgress({ welcomed: true });
}

export async function markCoachSeen(id: string, skipTour = false): Promise<void> {
  recordProgress((p) => ({ coachSeen: [...new Set([...p.coachSeen, id])], tourSkipped: p.tourSkipped || skipTour }));
}

/** Called wherever the creator copies or shares their store link. */
export function markLinkShared(): void {
  recordProgress({ shared: true });
}
