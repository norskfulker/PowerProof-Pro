import { money } from "../money";
import type { DealRule } from "../types/deals";
import type { StorePageDoc } from "../pages/schema";
import type { AuditEntry } from "../types/search";
import type { AiGeneration, MediaItem } from "../types/media";
import type {
  BillingInvoice,
  Company,
  Customer,
  Integration,
  InvoiceSettings,
  ISODate,
  Notification,
  Order,
  Page,
  Payout,
  PayoutMethod,
  Plan,
  Product,
  Sku,
  Store,
  TaxCode,
  TeamMember,
  Bundle,
  Collection,
  Coupon,
  Deal,
  Question,
  Review,
  StoreDesign,
  StorePages,
  StoreDomains,
} from "../types";
import { buildDesign, defaultPages } from "./storefront-seed";
import { TAX_CODES } from "./catalog";
import { DAY } from "./random";

const iso = (t: number) => new Date(t).toISOString();

/** Everything a public store needs. The creator's own store is the Db itself; demo stores live in otherStores. */
export interface StoreScope {
  store: Store;
  company: Company;
  invoice: InvoiceSettings;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  taxCodes: TaxCode[];
  design: StoreDesign;
  storePages: StorePages;
  collections: Collection[];
  coupons: Coupon[];
  bundles: Bundle[];
  deals: Deal[];
  /** Deal paths shown at checkout (Part 4B) */
  dealRules: DealRule[];
  /** Visual store pages built in the editor (Part 4C) */
  visualPages: StorePageDoc[];
  reviews: Review[];
  questions: Question[];
  subscribers: string[];
  /** Free subdomain and an optional custom domain (Part 7B) */
  domains?: StoreDomains;
}

/** Shape of the mock database, plus the pieces shared by the seeded and the fresh store. */
export interface Db extends StoreScope {
  version: number;
  mode: "seeded" | "fresh" | "stress";
  otherStores: StoreScope[];
  payouts: Payout[];
  payoutMethods: PayoutMethod[];
  pages: Page[];
  skus: Sku[];
  integrations: Integration[];
  team: TeamMember[];
  plan: Plan;
  billing: BillingInvoice[];
  notifications: Notification[];
  /** Founder-admin audit trail: contact reveals and destructive quick actions. Newest first. */
  audit?: AuditEntry[];
  /**
   * The creator's other stores (Part 6C). The active store lives in the top-level fields so every
   * existing API keeps working; switching stores swaps them.
   */
  ownedStores: StoreScope[];
  /** Media library: uploads and AI images, shared by all of the creator's stores */
  media: MediaItem[];
  /** AI image maker history, newest first */
  aiHistory: AiGeneration[];
  aiCreditsUsed: { month: string; used: number };
  /** Opening balance (minor units) so seeded history adds up; new activity moves it. */
  ledger: { opening: number; since: ISODate };
}

export const DB_VERSION = 10;
/** Money settles two days after payment (T+2). */
export const SETTLE_MS = 2 * 24 * 60 * 60 * 1000;


export function baseStore(now: number, over: Partial<Store> = {}): Store {
  return {
    id: "store_ananya",
    name: "Ananya Makes",
    slug: "ananya",
    tagline: "Notion kits, presets and playbooks for people who make things.",
    ownerName: "Ananya Rao",
    ownerEmail: "ananya@example.com",
    brandColor: "#0F3D33",
    logoText: "AM",
    currency: "INR",
    supportEmail: "help@ananyamakes.in",
    refundPolicy:
      "If the file doesn't open or isn't what the page described, write within 7 days and you get your money back.",
    refundDays: 7,
    createdAt: iso(now - 64 * DAY),
    onboarded: true,
    ...over,
  };
}

export function baseCompany(): Company {
  return {
    legalName: "Ananya Rao",
    businessType: "proprietorship",
    gstin: "27ABCPR1234F1Z5",
    pan: "ABCPR1234F",
    address1: "14, Sea Breeze Apartments, Carter Road",
    address2: "Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    country: "India",
  };
}

export function baseIntegrations(connectedGa: boolean): Integration[] {
  return [
    {
      id: "google-analytics",
      name: "Google Analytics",
      description: "Send store and checkout page views to your GA4 property.",
      idLabel: "Measurement ID",
      idPlaceholder: "G-XXXXXXXXXX",
      value: connectedGa ? "G-7QH2K4M9PL" : undefined,
      connected: connectedGa,
      connectedAt: connectedGa ? new Date(Date.now() - 20 * DAY).toISOString() : undefined,
    },
    {
      id: "microsoft-clarity",
      name: "Microsoft Clarity",
      description: "Watch session recordings and heatmaps of your buyer pages.",
      idLabel: "Project ID",
      idPlaceholder: "abcd1234ef",
      connected: false,
    },
  ];
}

export function basePlan(now: number, storeCreated: number, tier: Plan["tier"] = "pro"): Plan {
  if (tier === "free") {
    return { tier, name: "Free", monthly: money(0, "USD"), platformFeePct: 3, gatewayFeePct: 2, trialEndsAt: iso(storeCreated), status: "active" };
  }
  return {
    tier,
    name: "Pro",
    monthly: money(2000, "USD"),
    platformFeePct: 3,
    gatewayFeePct: 2,
    trialEndsAt: iso(storeCreated + 30 * DAY),
    status: storeCreated + 30 * DAY > now ? "trial" : "active",
    cardLast4: storeCreated + 30 * DAY > now ? undefined : "4242",
  };
}

/** A brand-new, empty store with sensible default text for its pages and policies. */
export function freshScope(now: number, s: Store): StoreScope {
  return {
    store: s,
    company: { legalName: "", businessType: "individual", address1: "", city: "", state: "", pincode: "", country: "India" },
    invoice: { prefix: "INV", nextNumber: 1, showGstin: false, footerNote: "Thank you for your purchase.", defaultTaxCode: "998433", pricesIncludeTax: true },
    products: [],
    orders: [],
    customers: [],
    taxCodes: TAX_CODES,
    design: { ...buildDesign({
      store: s,
      palette: "emerald",
      fonts: "modern",
      heroStyle: "left",
      hero: { headline: s.name, subtext: s.tagline, cta: "Shop now" },
      heroProductIds: [],
      story: `Hi, I'm ${s.ownerName.split(" ")[0]}. I make things for people who make things.`,
      city: "India",
      dealEndsAt: iso(now),
    }), announcement: { text: "Welcome! New products are on the way." } },
    storePages: defaultPages(s),
    collections: [],
    coupons: [],
    bundles: [],
    deals: [],
    dealRules: [],
    visualPages: [],
    reviews: [],
    questions: [],
    subscribers: [],
  };
}

export function freshDb(now: number, store: Partial<Store>, otherStores: StoreScope[]): Db {
  const s = baseStore(now, { createdAt: iso(now), onboarded: false, ...store });
  return {
    ...freshScope(now, s),
    otherStores,
    ownedStores: [],
    media: [],
    aiHistory: [],
    aiCreditsUsed: { month: iso(now).slice(0, 7), used: 0 },
    version: DB_VERSION,
    mode: "fresh",
    payouts: [],
    payoutMethods: [],
    pages: [],
    skus: [],
    integrations: baseIntegrations(false),
    team: [{ id: "tm_owner", name: s.ownerName, email: s.ownerEmail, role: "owner", status: "active" }],
    plan: basePlan(now, now, "free"),
    billing: [],
    notifications: [
      { id: "n_welcome", kind: "system", title: "Your store is set up", body: "Add a product and share your link. That's the whole job.", createdAt: iso(now), read: false, href: "/catalog/products/new" },
    ],
    ledger: { opening: 0, since: iso(now) },
  };
}

