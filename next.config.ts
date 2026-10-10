import type { NextConfig } from "next";

/**
 * Routes follow the menu (Part 7C): /catalog, /store/[id], /sales, /tools, /settings.
 * Every old address keeps working through these redirects. Store screens that didn't carry a
 * store id go to /store/current/..., which the store layout turns into the active store's id.
 * Temporary (307) so links can still change while the app is in preview; query strings carry over.
 */
const MOVED: [from: string, to: string][] = [
  // Catalog
  ["/products", "/catalog/products"],
  ["/products/:path*", "/catalog/products/:path*"],
  ["/media", "/catalog/media"],
  ["/pages", "/store/current/design/pages"],
  // The old Design tabs now live under Design › Base design (Advanced)
  ["/store/:id/design/theme", "/store/:id/design/base"],
  ["/store/:id/design/sections", "/store/:id/design/base"],
  ["/store/:id/design/backgrounds", "/store/:id/design/base"],
  ["/store/:id/design/content", "/store/:id/design/base"],
  ["/store/collections", "/catalog/collections"],
  // Sales
  ["/orders", "/sales/orders"],
  ["/orders/:path*", "/sales/orders/:path*"],
  ["/customers", "/sales/customers"],
  ["/customers/:path*", "/sales/customers/:path*"],
  ["/payouts", "/sales/payouts/balance"],
  ["/analytics", "/dashboard"],
  ["/sales/analytics", "/dashboard"],
  // Tools
  ["/images", "/tools/ai-images"],
  ["/integrations", "/tools/integrations"],
  // Store screens, now under the store they belong to
  ["/store", "/store/current/design/theme"],
  ["/store/design", "/store/current/design/theme"],
  ["/store/pages", "/store/current/design/pages"],
  ["/store/pages/:page/versions", "/store/current/design/pages/:page/versions"],
  ["/store/pages/:page/edit", "/store/current/design/pages/:page/edit"],
  ["/store/offers", "/store/current/offers/coupons"],
  ["/store/offers/deal-paths", "/store/current/offers/deal-paths"],
  ["/store/offers/deal-paths/:path*", "/store/current/offers/deal-paths/:path*"],
  ["/store/reviews", "/store/current/reviews"],
  ["/store/questions", "/store/current/questions"],
  ["/store/seo", "/store/current/seo"],
  ["/store/domain", "/store/current/domain"],
  ["/store/info", "/store/current/pages/about"],
  ["/settings/store", "/store/current/settings"],
  // Section roots open their first page
  ["/catalog", "/catalog/products"],
  ["/sales", "/sales/orders"],
  ["/sales/payouts", "/sales/payouts/balance"],
  ["/tools", "/tools/ai-images"],
  ["/store/:id", "/store/:id/design/theme"],
  ["/store/:id/design", "/store/:id/design/theme"],
  ["/store/:id/offers", "/store/:id/offers/coupons"],
  ["/store/:id/pages", "/store/:id/pages/home"],
  // Admin
  ["/admin/disputes", "/admin/orders/disputed"],
  ["/admin/payouts", "/admin/money/payouts"],
  ["/admin/flags", "/admin/moderation/flags"],
  ["/admin/audit", "/admin/system/audit"],
  ["/admin/search", "/admin/system/search"],
  ["/admin/money", "/admin/money/payouts"],
  ["/admin/moderation", "/admin/moderation/flags"],
  ["/admin/system", "/admin/system/audit"],
];

/**
 * The redirects above are for PowerProof's own addresses only. A store on its own domain serves
 * buyer pages like /products (lib/domain-routing.ts), so they must never apply there. The same
 * hosts as isAppHost: local, *.workers.dev previews, and the site's address (with or without www).
 */
function appHosts(): string {
  let own = "";
  try {
    own = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname.toLowerCase() : "";
  } catch {
    /* no valid site address set */
  }
  const esc = (h: string) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const names = ["localhost", "127\\.0\\.0\\.1", "\\[::1\\]", ".+\\.localhost", ".+\\.workers\\.dev", ...(own ? [`(www\\.)?${esc(own)}`] : [])];
  return `(${names.join("|")})(:\\d+)?`;
}

const nextConfig: NextConfig = {
  async redirects() {
    const host = appHosts();
    return MOVED.map(([source, destination]) => ({ source, destination, permanent: false, has: [{ type: "host" as const, value: host }] }));
  },
};

export default nextConfig;
