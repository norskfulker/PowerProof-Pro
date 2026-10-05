import type { ISODate, Money } from "./money";

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
