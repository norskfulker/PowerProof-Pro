/** The order as a buyer's page and invoice see it. Plain data: safe to import from the browser. */
import type { AnalyticsTags } from "../types";

export interface OrderView {
  id: string;
  storeId: string;
  /** The store's analytics tags, so a purchase can be reported after the visitor agreed */
  analytics?: AnalyticsTags;
  ref: string;
  status: "pending" | "paid" | "failed" | "refunded";
  storeName: string;
  storeSlug: string;
  supportEmail?: string;
  buyerName: string;
  buyerEmail: string;
  buyerCountry: string;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  invoiceNo?: string;
  paidAt?: string;
  /** Products in this order the buyer has already reviewed */
  reviewed: string[];
  lines: { productId?: string; title: string; unit: number; discount: number; total: number; gift: boolean; hsn?: string; rateBps?: number }[];
  files: { id: string; name: string; size: number; product: string }[];
  store: { legalName?: string; gstin?: string; pan?: string; address?: string; invoicePrefix?: string; invoiceFooter?: string };
}
