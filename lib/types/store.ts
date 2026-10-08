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
  footerNote: string;
}
