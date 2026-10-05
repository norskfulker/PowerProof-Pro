/**
 * Domain types shared by the mock layer and (later) the real backend.
 * Money is always integer minor units plus an ISO currency code.
 */

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD" | "AUD" | "CAD";

export interface Money {
  /** Integer minor units (paise, cents). */
  amount: number;
  currency: CurrencyCode;
}

export type ISODate = string;

/* ---------------------------------------------------------------- */
/* Store and creator                                                 */
/* ---------------------------------------------------------------- */

export interface Store {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  ownerName: string;
  ownerEmail: string;
  brandColor: string;
  logoText: string;
  currency: CurrencyCode;
  supportEmail: string;
  refundPolicy: string;
  refundDays: number;
  createdAt: ISODate;
  onboarded: boolean;
}

export interface Company {
  legalName: string;
  businessType: "individual" | "proprietorship" | "partnership" | "llp" | "private_limited";
  gstin?: string;
  pan?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface InvoiceSettings {
  prefix: string;
  nextNumber: number;
  showGstin: boolean;
  footerNote: string;
  defaultTaxCode: string;
  pricesIncludeTax: boolean;
}

/* ---------------------------------------------------------------- */
/* Products                                                          */
/* ---------------------------------------------------------------- */

export type ProductStatus = "published" | "draft" | "archived";
export type ProductKind = "ebook" | "template" | "preset" | "notion" | "course" | "audio" | "other";

export type CoverTemplate = "block" | "split" | "frame" | "stack" | "badge" | "grid";

export interface CoverSpec {
  template: CoverTemplate;
  title: string;
  subtitle?: string;
  bg: string;
  fg: string;
  accent: string;
}

export interface ProductImage {
  id: string;
  alt: string;
  /** A real image URL (object URL or remote). */
  src?: string;
  /** Or a generated cover. */
  cover?: CoverSpec;
}

export interface ProductFile {
  id: string;
  name: string;
  /** Bytes */
  size: number;
  mime: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: ProductKind;
  price: Money;
  compareAt?: Money;
  images: ProductImage[];
  files: ProductFile[];
  sku: string;
  taxCode: string;
  status: ProductStatus;
  sourceUrl?: string;
  pageId?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Denormalized for lists */
  salesCount: number;
  revenue: Money;
}

export type ProductInput = Pick<
  Product,
  "title" | "description" | "kind" | "price" | "images" | "files" | "sku" | "taxCode" | "status"
> & { sourceUrl?: string; compareAt?: Money };

export interface LinkAutofill {
  url: string;
  sourceName: string;
  title: string;
  description: string;
  price: Money;
  images: ProductImage[];
  kind: ProductKind;
}

/* ---------------------------------------------------------------- */
/* Orders and customers                                              */
/* ---------------------------------------------------------------- */

export type OrderStatus = "pending" | "paid" | "refund_requested" | "refunded" | "failed";

export interface OrderFees {
  gateway: Money;
  platform: Money;
}

export interface Order {
  id: string;
  number: string;
  productId: string;
  productTitle: string;
  customerId: string;
  buyerName: string;
  buyerEmail: string;
  country: string;
  countryCode: string;
  /** What the buyer saw and paid. */
  buyerTotal: Money;
  /** Settled amount in the store currency. */
  total: Money;
  fees: OrderFees;
  net: Money;
  status: OrderStatus;
  source: TrafficSource;
  downloads: number;
  invoiceNumber?: string;
  paymentMethod: "upi" | "card" | "netbanking" | "wallet";
  createdAt: ISODate;
  paidAt?: ISODate;
  refundedAt?: ISODate;
  refundReason?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
  countryCode: string;
  currency: CurrencyCode;
  ordersCount: number;
  totalSpent: Money;
  firstOrderAt: ISODate;
  lastOrderAt: ISODate;
}

export type TrafficSource = "instagram" | "direct" | "google" | "youtube" | "twitter" | "newsletter";

/* ---------------------------------------------------------------- */
/* Money out                                                         */
/* ---------------------------------------------------------------- */

export type PayoutStatus = "processing" | "paid" | "failed";

export interface PayoutMethod {
  id: string;
  kind: "bank" | "usdt";
  label: string;
  /** Masked, e.g. ····4821 */
  last4: string;
  holderName: string;
  ifsc?: string;
  bankName?: string;
  verified: boolean;
  primary: boolean;
  comingSoon?: boolean;
}

export interface Payout {
  id: string;
  amount: Money;
  status: PayoutStatus;
  methodId: string;
  methodLabel: string;
  reference?: string;
  createdAt: ISODate;
  arrivedAt?: ISODate;
  failureReason?: string;
}

export interface Balance {
  available: Money;
  pending: Money;
  /** When the oldest pending money becomes available. */
  nextReleaseAt?: ISODate;
  lifetimePaidOut: Money;
}

/* ---------------------------------------------------------------- */
/* Pages, SKUs, tax, integrations                                    */
/* ---------------------------------------------------------------- */

export type PageTemplate = "launch" | "minimal" | "bundle" | "creator" | "waitlist" | "blank";

export interface PageBlock {
  id: string;
  type: "hero" | "features" | "testimonial" | "faq" | "buy" | "text";
  heading: string;
  body: string;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  template: PageTemplate;
  mode: "visual" | "html";
  blocks: PageBlock[];
  html: string;
  productIds: string[];
  status: "live" | "draft";
  views: number;
  updatedAt: ISODate;
}

export interface Sku {
  id: string;
  code: string;
  productId?: string;
  productTitle?: string;
  taxCode: string;
  note?: string;
}

export interface TaxCode {
  code: string;
  kind: "HSN" | "SAC";
  description: string;
  /** GST rate in percent */
  rate: number;
  isDefault?: boolean;
}

export type IntegrationId = "google-analytics" | "microsoft-clarity";

export interface Integration {
  id: IntegrationId;
  name: string;
  description: string;
  idLabel: string;
  idPlaceholder: string;
  value?: string;
  connected: boolean;
  connectedAt?: ISODate;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "support";
  status: "active" | "invited";
}

export interface BillingInvoice {
  id: string;
  period: string;
  amount: Money;
  platformFees: Money;
  status: "paid" | "due" | "free";
  issuedAt: ISODate;
}

export interface Plan {
  name: string;
  monthly: Money;
  platformFeePct: number;
  gatewayFeePct: number;
  trialEndsAt: ISODate;
  status: "trial" | "active" | "past_due";
  cardLast4?: string;
}

export interface Notification {
  id: string;
  kind: "sale" | "payout" | "refund" | "system";
  title: string;
  body: string;
  createdAt: ISODate;
  read: boolean;
  href?: string;
}

/* ---------------------------------------------------------------- */
/* Analytics                                                         */
/* ---------------------------------------------------------------- */

export type RangeKey = "today" | "7d" | "30d" | "90d";

export interface SeriesPoint {
  label: string;
  revenue: number; // major units, for charts only
  visitors: number;
  orders: number;
}

export interface Summary {
  range: RangeKey;
  revenue: Money;
  sales: number;
  visitors: number;
  conversion: number; // percent
  deltas: { revenue: number; sales: number; visitors: number; conversion: number };
  series: SeriesPoint[];
  topProducts: { productId: string; title: string; sales: number; revenue: Money }[];
  sources: { source: TrafficSource; visitors: number; share: number }[];
  funnel: { label: string; value: number }[];
}

/* ---------------------------------------------------------------- */
/* Admin                                                             */
/* ---------------------------------------------------------------- */

export interface AdminCreator {
  id: string;
  storeName: string;
  slug: string;
  ownerName: string;
  email: string;
  city: string;
  plan: "trial" | "active" | "past_due" | "suspended";
  gmv30d: Money;
  orders30d: number;
  kyc: "verified" | "pending" | "rejected";
  joinedAt: ISODate;
  risk: "low" | "medium" | "high";
}

export interface Dispute {
  id: string;
  orderNumber: string;
  storeName: string;
  buyerEmail: string;
  amount: Money;
  reason: "not_received" | "not_as_described" | "fraud" | "duplicate";
  status: "open" | "won" | "lost" | "under_review";
  dueBy: ISODate;
  openedAt: ISODate;
}

export interface AdminPayout {
  id: string;
  storeName: string;
  amount: Money;
  method: string;
  status: "queued" | "on_hold" | "sent" | "failed";
  requestedAt: ISODate;
  note?: string;
}

export interface Flag {
  id: string;
  kind: "product" | "page" | "store";
  target: string;
  storeName: string;
  reason: string;
  reporter: string;
  status: "open" | "removed" | "dismissed";
  createdAt: ISODate;
}

/* ---------------------------------------------------------------- */
/* Session                                                           */
/* ---------------------------------------------------------------- */

export interface Session {
  name: string;
  email: string;
  storeId: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
