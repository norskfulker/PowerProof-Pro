import type { CurrencyCode, ISODate } from "./money";

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
  /** Set when the creator publishes the store (end of onboarding) */
  onboarded: boolean;
  /** Uploaded logo; logoText is the fallback */
  logo?: { src: string; alt: string };
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
