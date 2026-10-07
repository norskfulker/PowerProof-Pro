import type { Manifest } from "./support/manifest";

/**
 * Every route in the app. Screens that show one record use the ids of the data the global setup
 * created for creator A (see support/seed.ts); nothing here refers to a built-in demo.
 */

export interface RouteDef {
  path: string;
  /** Group used in the QA report */
  area: "marketing" | "auth" | "creator" | "store-admin" | "buyer" | "system";
  /** Must be viewed signed out (the app sends signed-in creators away from login and signup) */
  signedOut?: boolean;
  /** HTTP status the document itself returns (error pages) */
  expectStatus?: number;
}

export function buildRoutes(m: Manifest): RouteDef[] {
  const A = m.A;
  const store = (rest: string) => `/store/${A.storeId}${rest}`;
  const routes: RouteDef[] = [
    // Marketing and auth (signed out)
    { path: "/", area: "marketing", signedOut: true },
    { path: "/pricing", area: "marketing", signedOut: true },
    { path: "/how-it-works", area: "marketing", signedOut: true },
    { path: "/login", area: "auth", signedOut: true },
    { path: "/signup", area: "auth", signedOut: true },
    { path: "/forgot-password", area: "auth", signedOut: true },
    // Creator app
    { path: "/onboarding", area: "auth" },
    { path: "/dashboard", area: "creator" },
    { path: "/getting-started", area: "creator" },
    { path: "/catalog/products", area: "creator" },
    { path: "/catalog/products?status=live", area: "creator" },
    { path: "/catalog/products?status=draft", area: "creator" },
    { path: "/catalog/products?status=archived", area: "creator" },
    { path: "/catalog/products/new", area: "creator" },
    { path: "/catalog/products/new/upload", area: "creator" },
    { path: `/catalog/products/${A.productId}`, area: "creator" },
    { path: "/catalog/collections", area: "creator" },
    { path: "/catalog/bundles", area: "creator" },
    { path: "/catalog/media", area: "creator" },
    { path: "/sales/orders", area: "creator" },
    { path: "/sales/orders?status=paid", area: "creator" },
    { path: "/sales/customers", area: "creator" },
    { path: "/sales/payouts/balance", area: "creator" },
    { path: "/sales/payouts/history", area: "creator" },
    { path: "/sales/payouts/methods", area: "creator" },
    { path: "/tools/ai-images", area: "creator" },
    { path: "/tools/integrations", area: "creator" },
    { path: "/settings/profile", area: "creator" },
    { path: "/settings/company", area: "creator" },
    { path: "/settings/tax", area: "creator" },
    { path: "/settings/skus", area: "creator" },
    { path: "/settings/team", area: "creator" },
    { path: "/settings/billing", area: "creator" },
    // Store management
    { path: store("/settings"), area: "store-admin" },
    { path: store("/design/base"), area: "store-admin" },
    { path: store("/design/pages"), area: "store-admin" },
    { path: store(`/design/pages/${A.pageId}/edit`), area: "store-admin" },
    { path: store(`/design/pages/${A.pageId}/versions`), area: "store-admin" },
    { path: store("/pages/home"), area: "store-admin" },
    { path: store("/pages/about"), area: "store-admin" },
    { path: store("/pages/faq"), area: "store-admin" },
    { path: store("/pages/policies/refund"), area: "store-admin" },
    { path: store("/offers/coupons"), area: "store-admin" },
    { path: store("/offers/bundles"), area: "store-admin" },
    { path: store("/offers/deals"), area: "store-admin" },
    { path: store("/offers/deal-paths"), area: "store-admin" },
    { path: store("/offers/deal-paths/new"), area: "store-admin" },
    { path: store("/reviews"), area: "store-admin" },
    { path: store("/questions"), area: "store-admin" },
    { path: store("/domain"), area: "store-admin" },
    { path: store("/seo"), area: "store-admin" },
    { path: store("/analytics-tags"), area: "store-admin" },
    // Buyer (public)
    { path: `/s/${A.slug}`, area: "buyer", signedOut: true },
    { path: `/s/${A.slug}/products`, area: "buyer", signedOut: true },
    { path: `/s/${A.slug}/c/${A.collectionSlug}`, area: "buyer", signedOut: true },
    { path: `/s/${A.slug}/${A.productSlug}`, area: "buyer", signedOut: true },
    { path: `/s/${A.slug}/about`, area: "buyer", signedOut: true },
    { path: `/s/${A.slug}/faq`, area: "buyer", signedOut: true },
    { path: `/s/${A.slug}/contact`, area: "buyer", signedOut: true },
    { path: `/s/${A.slug}/policies/refund`, area: "buyer", signedOut: true },
    { path: `/s/${A.slug}/p/${A.pageSlug}`, area: "buyer", signedOut: true },
    { path: "/lookup", area: "buyer", signedOut: true },
    { path: "/checkout/none", area: "buyer", signedOut: true },
    // System
    { path: "/500", area: "system", signedOut: true, expectStatus: 500 },
    { path: "/this-page-does-not-exist", area: "system", signedOut: true, expectStatus: 404 },
  ];
  if (A.dealRuleId) routes.push({ path: store(`/offers/deal-paths/${A.dealRuleId}`), area: "store-admin" });
  return routes;
}

/** Old addresses that must keep working */
export function buildRedirects(m: Manifest): [from: string, to: RegExp][] {
  return [
    ["/products", /\/catalog\/products$/],
    [`/products/${m.A.productId}`, new RegExp(`/catalog/products/${m.A.productId}$`)],
    ["/payouts?withdraw=1", /\/sales\/payouts\/balance\?withdraw=1$/],
    ["/images", /\/tools\/ai-images$/],
    ["/analytics", /\/dashboard$/],
    ["/sales/analytics", /\/dashboard$/],
    ["/catalog/sales-pages", /\/store\/[^/]+\/design\/pages$/],
    ["/admin/disputes", /\/admin\/orders\/disputed$|\/dashboard$/],
  ];
}
