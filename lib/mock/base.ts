import { money } from "../money";
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
} from "../types";
import { TAX_CODES } from "./catalog";
import { DAY } from "./random";

const iso = (t: number) => new Date(t).toISOString();

/** Shape of the mock database, plus the pieces shared by the seeded and the fresh store. */
export interface Db {
  version: number;
  mode: "seeded" | "fresh";
  store: Store;
  company: Company;
  invoice: InvoiceSettings;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  payouts: Payout[];
  payoutMethods: PayoutMethod[];
  pages: Page[];
  skus: Sku[];
  taxCodes: TaxCode[];
  integrations: Integration[];
  team: TeamMember[];
  plan: Plan;
  billing: BillingInvoice[];
  notifications: Notification[];
  /** Opening balance (minor units) so seeded history adds up; new activity moves it. */
  ledger: { opening: number; since: ISODate };
}

export const DB_VERSION = 3;
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

export function basePlan(now: number, storeCreated: number): Plan {
  return {
    name: "PowerProof",
    monthly: money(2000, "USD"),
    platformFeePct: 3,
    gatewayFeePct: 2,
    trialEndsAt: iso(storeCreated + 30 * DAY),
    status: storeCreated + 30 * DAY > now ? "trial" : "active",
    cardLast4: storeCreated + 30 * DAY > now ? undefined : "4242",
  };
}

export function freshDb(now: number, store: Partial<Store>): Db {
  const s = baseStore(now, { createdAt: iso(now), onboarded: false, ...store });
  return {
    version: DB_VERSION,
    mode: "fresh",
    store: s,
    company: { legalName: "", businessType: "individual", address1: "", city: "", state: "", pincode: "", country: "India" },
    invoice: { prefix: "INV", nextNumber: 1, showGstin: false, footerNote: "Thank you for your purchase.", defaultTaxCode: "998433", pricesIncludeTax: true },
    products: [],
    orders: [],
    customers: [],
    payouts: [],
    payoutMethods: [],
    pages: [],
    skus: [],
    taxCodes: TAX_CODES,
    integrations: baseIntegrations(false),
    team: [{ id: "tm_owner", name: s.ownerName, email: s.ownerEmail, role: "owner", status: "active" }],
    plan: basePlan(now, now),
    billing: [{ id: "bill_0", period: "First month", amount: money(0, "USD"), platformFees: money(0), status: "free", issuedAt: iso(now) }],
    notifications: [
      { id: "n_welcome", kind: "system", title: "Your store is set up", body: "Add a product and share your link. That's the whole job.", createdAt: iso(now), read: false, href: "/products/new" },
    ],
    ledger: { opening: 0, since: iso(now) },
  };
}

