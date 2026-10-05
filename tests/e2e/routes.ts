/** Every route in the app, with ids from the deterministic seed (lib/mock/seed.ts). */
const token = (n: number) => `tok_${n}_${(n * 7919).toString(36)}`;

export interface RouteDef {
  path: string;
  /** Group used in the QA report */
  area: "marketing" | "auth" | "creator" | "store-admin" | "buyer" | "admin" | "system";
  /** Skip the tap-target check (e.g. the design kitchen sink renders raw specimens) */
  relaxTargets?: boolean;
  /** HTTP status the document itself returns (error pages) */
  expectStatus?: number;
}

export const ROUTES: RouteDef[] = [
  // Marketing and auth
  { path: "/", area: "marketing" },
  { path: "/pricing", area: "marketing" },
  { path: "/how-it-works", area: "marketing" },
  { path: "/templates", area: "marketing" },
  { path: "/login", area: "auth" },
  { path: "/signup", area: "auth" },
  { path: "/forgot-password", area: "auth" },
  { path: "/verify-email?email=a@example.com", area: "auth" },
  { path: "/onboarding", area: "auth" },
  // Creator app
  { path: "/dashboard", area: "creator" },
  { path: "/products", area: "creator" },
  { path: "/products/new", area: "creator" },
  { path: "/products/new/link", area: "creator" },
  { path: "/products/new/upload", area: "creator" },
  { path: "/products/new/page", area: "creator" },
  { path: "/products/prod_01", area: "creator" },
  { path: "/images", area: "creator" },
  { path: "/pages", area: "creator" },
  { path: "/pages/new", area: "creator" },
  { path: "/pages/page_launch/edit", area: "creator" },
  { path: "/pages/page_html/html", area: "creator" },
  { path: "/orders", area: "creator" },
  { path: "/orders/ord_1078", area: "creator" },
  { path: "/customers", area: "creator" },
  { path: "/customers/cus_01", area: "creator" },
  { path: "/payouts", area: "creator" },
  { path: "/analytics", area: "creator" },
  { path: "/integrations", area: "creator" },
  { path: "/settings/profile", area: "creator" },
  { path: "/settings/store", area: "creator" },
  { path: "/settings/company", area: "creator" },
  { path: "/settings/tax", area: "creator" },
  { path: "/settings/skus", area: "creator" },
  { path: "/settings/team", area: "creator" },
  { path: "/settings/billing", area: "creator" },
  // Store management
  { path: "/store/design", area: "store-admin" },
  { path: "/store/collections", area: "store-admin" },
  { path: "/store/offers", area: "store-admin" },
  { path: "/store/offers/deal-paths", area: "store-admin" },
  { path: "/store/offers/deal-paths/new", area: "store-admin" },
  { path: "/store/offers/deal-paths/dr_ananya_pair", area: "store-admin" },
  { path: "/store/reviews", area: "store-admin" },
  { path: "/store/questions", area: "store-admin" },
  { path: "/store/pages", area: "store-admin" },
  { path: "/store/info", area: "store-admin" },
  { path: "/store/pages/vp_ananya_about-ananya/edit", area: "store-admin" },
  { path: "/store/pages/vp_ananya_about-ananya/versions", area: "store-admin" },
  { path: "/store/seo", area: "store-admin" },
  { path: "/store/domain", area: "store-admin" },
  // Buyer
  { path: "/s/ananya", area: "buyer" },
  { path: "/s/inkwell", area: "buyer" },
  { path: "/s/gridgrain", area: "buyer" },
  { path: "/s/ananya/products", area: "buyer" },
  { path: "/s/ananya/c/notion-kits", area: "buyer" },
  { path: "/s/ananya/second-brain-for-founders", area: "buyer" },
  { path: "/s/inkwell/the-quiet-freelancer", area: "buyer" },
  { path: "/s/gridgrain/pitch-deck-kit", area: "buyer" },
  { path: "/s/ananya/about", area: "buyer" },
  { path: "/s/ananya/faq", area: "buyer" },
  { path: "/s/ananya/contact", area: "buyer" },
  { path: "/s/ananya/policies/refund", area: "buyer" },
  { path: "/s/ananya/p/about-ananya", area: "buyer" },
  { path: "/s/ananya/p/diwali-sale", area: "buyer" },
  { path: "/s/inkwell/p/links", area: "buyer" },
  { path: "/s/gridgrain/p/work", area: "buyer" },
  { path: "/checkout/ord_1080", area: "buyer" },
  { path: "/success/ord_1081", area: "buyer" },
  { path: `/order/${token(1081)}`, area: "buyer" },
  { path: "/lookup", area: "buyer" },
  { path: "/invoice/ord_1081", area: "buyer" },
  // Emails
  { path: "/emails", area: "system" },
  { path: "/emails/receipt", area: "system" },
  // Admin
  { path: "/admin", area: "admin" },
  { path: "/admin/creators", area: "admin" },
  { path: "/admin/orders", area: "admin" },
  { path: "/admin/disputes", area: "admin" },
  { path: "/admin/payouts", area: "admin" },
  { path: "/admin/flags", area: "admin" },
  { path: "/admin/search", area: "admin" },
  { path: "/admin/search?q=%40ananya", area: "admin" },
  { path: "/admin/audit", area: "admin" },
  // System
  { path: "/design", area: "system", relaxTargets: true },
  { path: "/500", area: "system", expectStatus: 500 },
  { path: "/this-page-does-not-exist", area: "system", expectStatus: 404 },
];

export const ORDER_TOKEN = token(1081);
