import type { Order, PayoutMethod, Product } from "@/lib/types";

/** Static examples for the design reference only. Real screens use /lib/api. */
export const SAMPLE_PRODUCT: Product = {
  id: "demo",
  slug: "second-brain",
  title: "Second Brain for Founders",
  description: "A Notion workspace for founders who think in voice notes.",
  kind: "notion",
  price: { amount: 149900, currency: "INR" },
  compareAt: { amount: 249900, currency: "INR" },
  images: [
    {
      id: "i1",
      alt: "Cover",
      cover: { template: "split", title: "Second Brain for Founders", subtitle: "Notion kit", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" },
    },
  ],
  files: [],
  sku: "AM-NOT-001",
  taxCode: "998433",
  status: "published",
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  salesCount: 42,
  revenue: { amount: 6295800, currency: "INR" },
};

export const SAMPLE_ORDER: Order = {
  id: "ord_demo",
  number: "PP-1081",
  productId: "demo",
  productTitle: "Second Brain for Founders",
  customerId: "c1",
  buyerName: "Emily Carter",
  buyerEmail: "emily.carter@gmail.com",
  country: "United States",
  countryCode: "US",
  buyerTotal: { amount: 1799, currency: "USD" },
  total: { amount: 149900, currency: "INR" },
  fees: { gateway: { amount: 2998, currency: "INR" }, platform: { amount: 4497, currency: "INR" } },
  net: { amount: 142405, currency: "INR" },
  status: "paid",
  source: "instagram",
  downloads: 1,
  invoiceNumber: "INV-0081",
  paymentMethod: "card",
  createdAt: "2026-10-05T09:12:00.000Z",
  paidAt: "2026-10-05T09:12:20.000Z",
};

export const SAMPLE_METHODS: PayoutMethod[] = [
  { id: "b", kind: "bank", label: "HDFC Bank", last4: "4821", holderName: "Ananya Rao", ifsc: "HDFC0000123", verified: true, primary: true },
  { id: "u", kind: "usdt", label: "USDT (TRC-20)", last4: "", holderName: "", verified: false, primary: false, comingSoon: true },
];

export const SAMPLE_SERIES = [
  { label: "Mon", revenue: 2400, visitors: 310 },
  { label: "Tue", revenue: 3800, visitors: 420 },
  { label: "Wed", revenue: 1900, visitors: 280 },
  { label: "Thu", revenue: 5200, visitors: 510 },
  { label: "Fri", revenue: 4300, visitors: 460 },
  { label: "Sat", revenue: 6100, visitors: 690 },
  { label: "Sun", revenue: 4850, visitors: 520 },
];
