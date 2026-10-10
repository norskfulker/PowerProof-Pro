/** The order as a buyer's page and invoice see it. Plain data: safe to import from the browser. */
import type { AnalyticsTags } from "../types";

export interface OrderView {
  id: string;
  storeId: string;
  /** The store's analytics tags, so a purchase can be reported after the visitor agreed */
  analytics?: AnalyticsTags;
  ref: string;
  status: "pending" | "cod" | "paid" | "failed" | "refunded";
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
  lines: { productId?: string; title: string; unit: number; discount: number; total: number; gift: boolean; hsn?: string; rateBps?: number; quantity?: number; variant?: string | null; physical?: boolean }[];
  /** Physical orders */
  shipping?: number;
  codFee?: number;
  paymentMethod?: "online" | "cod";
  shipTo?: { name: string; phone: string; line1: string; line2?: string; city: string; state?: string; pincode: string; country: string } | null;
  fulfilment?: "unfulfilled" | "shipped" | "delivered" | "cancelled" | null;
  tracking?: { carrier?: string; number?: string; url?: string } | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  files: { id: string; name: string; size: number; product: string }[];
  /** The seller's invoice details. invoiceName is the name buyers see; legalName is the registered one (GST). */
  store: { invoiceName?: string; legalName?: string; gstin?: string; pan?: string; address?: string; invoicePrefix?: string; invoiceFooter?: string };
}
