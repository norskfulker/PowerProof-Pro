import {
  AlertOctagon, Banknote, Box, Brush, FileText, Flag, FolderOpen, Globe, Home, Images, LayoutDashboard, LifeBuoy, MessagesSquare,
  Package, Plug, Receipt, ScrollText, Search, Settings, Shield, Sparkles, Star, Store, Ticket, Users, Wallet, Wrench, type LucideIcon,
} from "lucide-react";

/**
 * The one navigation config (Part 7C). The sidebar, mobile drawer, breadcrumbs, command palette and
 * empty-state links all read this tree. Never write nav items by hand in components.
 */

export type BadgeKey = "products_all" | "products_live" | "products_draft" | "products_archived" | "reviews_pending" | "questions_open" | "disputes_open" | "orders_disputed";

export interface NavNode {
  id: string;
  label: string;
  /** Leaf link. `{store}` is replaced with the active store id. */
  href?: string;
  icon?: LucideIcon;
  children?: NavNode[];
  badge?: BadgeKey;
  /** Pro-only: shows a lock on Free and opens the Upgrade dialog */
  pro?: "customDomain";
  /** Children are filled in at runtime (collections and their products) */
  dynamic?: "collections";
  /** Extra path prefixes that count as this item (detail pages) */
  match?: string[];
  /** Shown in the bottom tab bar on phones */
  tab?: true;
}

export const CREATOR_NAV: NavNode[] = [
  {
    id: "home", label: "Home", icon: Home, children: [
      { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { id: "getting-started", label: "Getting started", href: "/getting-started", icon: LifeBuoy },
    ],
  },
  // The business flow, in order: Catalog (Collections, Products), Sales (Orders, Customers, Payouts),
  // then the Store's look and the rest. Store settings live under Settings.
  {
    id: "catalog", label: "Catalog", icon: Package, children: [
      {
        id: "collections", label: "Collections", icon: FolderOpen, dynamic: "collections", children: [
          { id: "collections-all", label: "All collections", href: "/catalog/collections", match: ["/catalog/collections/"] },
        ],
      },
      {
        id: "products", label: "Products", icon: Package, children: [
          { id: "products-all", label: "All products", href: "/catalog/products", badge: "products_all", match: ["/catalog/products/"] },
          { id: "products-live", label: "Live", href: "/catalog/products?status=live", badge: "products_live" },
          { id: "products-draft", label: "Draft", href: "/catalog/products?status=draft", badge: "products_draft" },
          { id: "products-archived", label: "Archived", href: "/catalog/products?status=archived", badge: "products_archived" },
        ],
      },
      { id: "bundles", label: "Bundles", href: "/catalog/bundles", icon: Box },
      { id: "media", label: "Media library", href: "/catalog/media", icon: Images },
    ],
  },
  {
    id: "sales", label: "Sales", icon: Receipt, children: [
      {
        id: "orders", label: "Orders", icon: Receipt, children: [
          { id: "orders-all", label: "All", href: "/sales/orders", match: ["/sales/orders/"] },
          { id: "orders-paid", label: "Paid", href: "/sales/orders?status=paid" },
          { id: "orders-refunded", label: "Refunded", href: "/sales/orders?status=refunded" },
          { id: "orders-disputed", label: "Disputed", href: "/sales/orders?status=disputed", badge: "orders_disputed" },
        ],
      },
      { id: "customers", label: "Customers", href: "/sales/customers", icon: Users, match: ["/sales/customers/"] },
      {
        id: "payouts", label: "Payouts", icon: Wallet, children: [
          { id: "payouts-balance", label: "Balance", href: "/sales/payouts/balance" },
          { id: "payouts-history", label: "History", href: "/sales/payouts/history" },
          { id: "payouts-methods", label: "Methods", href: "/sales/payouts/methods" },
        ],
      },
    ],
  },
  {
    id: "store", label: "Store", icon: Store, children: [
      {
        id: "design", label: "Design", icon: Brush, children: [
          { id: "design-base", label: "Base design", href: "/store/{store}/design/base", match: ["/store/{store}/design/theme", "/store/{store}/design/sections", "/store/{store}/design/backgrounds", "/store/{store}/design/content"] },
          { id: "design-pages", label: "Pages", href: "/store/{store}/design/pages", match: ["/store/{store}/design/pages/"] },
        ],
      },
      {
        id: "info-pages", label: "Info pages", icon: FileText, children: [
          { id: "pages-home", label: "Home", href: "/store/{store}/pages/home" },
          { id: "pages-about", label: "About", href: "/store/{store}/pages/about" },
          { id: "pages-faq", label: "FAQ", href: "/store/{store}/pages/faq" },
          {
            id: "policies", label: "Policies", children: [
              { id: "policy-refund", label: "Refund", href: "/store/{store}/pages/policies/refund" },
              { id: "policy-terms", label: "Terms", href: "/store/{store}/pages/policies/terms" },
              { id: "policy-privacy", label: "Privacy", href: "/store/{store}/pages/policies/privacy" },
            ],
          },
        ],
      },
      {
        id: "offers", label: "Offers", icon: Ticket, children: [
          { id: "offers-coupons", label: "Coupons", href: "/store/{store}/offers/coupons" },
          { id: "offers-bundles", label: "Bundles", href: "/store/{store}/offers/bundles" },
          { id: "offers-deal-paths", label: "Deal Paths", href: "/store/{store}/offers/deal-paths", match: ["/store/{store}/offers/deal-paths/"] },
          { id: "offers-deals", label: "Limited-time deals", href: "/store/{store}/offers/deals" },
        ],
      },
      {
        id: "engage", label: "Reviews and Q&A", icon: Star, children: [
          { id: "reviews", label: "Reviews", href: "/store/{store}/reviews", badge: "reviews_pending" },
          { id: "questions", label: "Questions", href: "/store/{store}/questions", badge: "questions_open" },
        ],
      },
      {
        id: "domain-seo", label: "Domain and SEO", icon: Globe, children: [
          { id: "domain", label: "Domain", href: "/store/{store}/domain", pro: "customDomain" },
          { id: "seo", label: "SEO", href: "/store/{store}/seo" },
          { id: "analytics-tags", label: "Analytics tags", href: "/store/{store}/analytics-tags" },
        ],
      },
    ],
  },
  {
    id: "tools", label: "Tools", icon: Wrench, children: [
      { id: "ai-images", label: "AI image maker", href: "/tools/ai-images", icon: Sparkles },
      { id: "integrations", label: "Integrations", href: "/tools/integrations", icon: Plug },
    ],
  },
  {
    id: "settings", label: "Settings", icon: Settings, children: [
      { id: "settings-store", label: "Store", href: "/store/{store}/settings", icon: Store, match: ["/store/{store}/settings"] },
      { id: "settings-profile", label: "Profile", href: "/settings/profile" },
      { id: "settings-company", label: "Company", href: "/settings/company" },
      { id: "settings-tax", label: "Tax (HSN/SAC)", href: "/settings/tax" },
      { id: "settings-skus", label: "SKUs", href: "/settings/skus" },
      { id: "settings-billing", label: "Billing and plan", href: "/settings/billing" },
      { id: "settings-team", label: "Team", href: "/settings/team" },
    ],
  },
];

export const ADMIN_NAV: NavNode[] = [
  { id: "a-overview", label: "Overview", href: "/admin", icon: LayoutDashboard },
  { id: "a-creators", label: "Creators", href: "/admin/creators", icon: Users },
  { id: "a-stores", label: "Stores", href: "/admin/stores", icon: Store },
  {
    id: "a-orders", label: "Orders", icon: Receipt, children: [
      { id: "a-orders-all", label: "All", href: "/admin/orders" },
      { id: "a-orders-disputed", label: "Disputed", href: "/admin/orders/disputed", badge: "disputes_open" },
    ],
  },
  {
    id: "a-money", label: "Money", icon: Banknote, children: [
      { id: "a-payouts", label: "Payouts", href: "/admin/money/payouts" },
      { id: "a-refunds", label: "Refunds", href: "/admin/money/refunds" },
    ],
  },
  {
    id: "a-moderation", label: "Moderation", icon: Shield, children: [
      { id: "a-flags", label: "Flags", href: "/admin/moderation/flags", icon: Flag },
      { id: "a-reviews", label: "Reviews", href: "/admin/moderation/reviews", icon: MessagesSquare },
    ],
  },
  {
    id: "a-system", label: "System", icon: ScrollText, children: [
      { id: "a-audit", label: "Audit", href: "/admin/system/audit" },
      { id: "a-search", label: "Search", href: "/admin/system/search", icon: Search },
    ],
  },
];

export interface TabItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Path prefixes that light this tab up */
  match: string[];
}

export const MOBILE_TABS: TabItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard, match: ["/dashboard", "/getting-started"] },
  { label: "Products", href: "/catalog/products", icon: Package, match: ["/catalog"] },
  { label: "Orders", href: "/sales/orders", icon: Receipt, match: ["/sales/orders"] },
  { label: "Settings", href: "/settings/profile", icon: Settings, match: ["/settings", "/store/{store}/settings"] },
];

export const ADMIN_TABS: TabItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, match: ["/admin"] },
  { label: "Creators", href: "/admin/creators", icon: Users, match: ["/admin/creators", "/admin/stores"] },
  { label: "Disputes", href: "/admin/orders/disputed", icon: AlertOctagon, match: ["/admin/orders"] },
  { label: "Payouts", href: "/admin/money/payouts", icon: Banknote, match: ["/admin/money"] },
];
