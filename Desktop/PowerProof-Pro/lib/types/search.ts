import type { ISODate, Money } from "./money";

export type SearchType =
  | "creator"
  | "store"
  | "product"
  | "order"
  | "buyer"
  | "payout"
  | "dispute"
  | "review"
  | "question"
  | "coupon"
  | "invoice"
  | "flag";

/** Admins see every store; creators only their own. */
export type SearchScope = "admin" | "creator";

export type QuickAction = "open" | "copy" | "refund" | "hide_review" | "suspend_store";

export interface SearchResult {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  storeSlug?: string;
  storeName?: string;
  date?: ISODate;
  amount?: Money;
  href: string;
  /** Masked for admins. Reveal with revealContact(type, id, field). */
  email?: string;
  phone?: string;
  /** True when email/phone above are masked */
  masked?: boolean;
  actions: QuickAction[];
}

export interface SearchFilters {
  types?: SearchType[];
  status?: string;
  /** Days back from now; undefined = any time */
  days?: number;
  storeSlug?: string;
}

export interface SearchGroup {
  type: SearchType;
  label: string;
  total: number;
  results: SearchResult[];
}

export interface SearchResponse {
  query: string;
  /** What the query was read as: "order number", "email", "phone", "store" or "text" */
  pattern: "order" | "invoice" | "email" | "phone" | "store" | "text";
  groups: SearchGroup[];
  total: number;
}

export interface AuditEntry {
  id: string;
  at: ISODate;
  actor: string;
  action: "reveal_email" | "reveal_phone" | "refund" | "hide_review" | "suspend_store";
  targetType: SearchType;
  targetId: string;
  targetLabel: string;
  reason?: string;
}
