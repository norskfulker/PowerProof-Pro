import type { ShippingSettings } from "../shipping";
import type { CurrencyCode, ISODate } from "./money";
import type { StoreAccess } from "../team";

export interface Store {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  ownerName: string;
  ownerEmail: string;
  brandColor: string;
  logoText: string;
  /** Where the creator is based (ISO code). It decides the currency, and both are fixed once there are products. */
  country: string;
  currency: CurrencyCode;
  supportEmail: string;
  refundPolicy: string;
  refundDays: number;
  createdAt: ISODate;
  /** Set when the creator publishes the store (end of onboarding) */
  onboarded: boolean;
  /** Uploaded logo; logoText is the fallback */
  logo?: { src: string; alt: string };
  /** Physical products: shipping zones and cash on delivery */
  shipping?: ShippingSettings;
  /** The seller name on checkout, receipts and invoices (falls back to the legal name, then the store name) */
  invoiceName?: string;
  /** What the signed-in person may do here (creator app only) */
  access?: StoreAccess;
  /** The owner's plan (creator app only) */
  ownerPlan?: "free" | "pro";
}

export interface Company {
  /** Shown to buyers at checkout and printed on receipts and invoices. Needed even without GST. */
  invoiceName: string;
  /** The registered name, for GST invoices. Optional when not registered. */
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
  footerNote: string;
}
