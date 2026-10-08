import {
  AlertOctagon, Banknote, Box, Brush, FileText, Flag, FolderOpen, Globe, Images, Inbox, LayoutDashboard, MessagesSquare,
  Package, Plug, Receipt, ScrollText, Search, Settings, Shield, ShoppingBag, Sparkles, Star, Store, Tag, Ticket, Users, Wallet, Wrench, type LucideIcon,
} from "lucide-react";

/**
 * The one navigation config (Part 7C). The sidebar, mobile drawer, store tabs, command palette and
 * empty-state links all read this tree. Never write nav items by hand in components.
 */

export type BadgeKey = "products_all" | "products_live" | "products_draft" | "products_archived" | "reviews_pending" | "questions_open" | "disputes_open" | "orders_disputed" | "reports_open" | "payouts_open";

export interface NavNode {
  id: string;
  label: string;
  /** The link. `{store}` is replaced with the active store id. A group has none: clicking it only opens or closes it. */
  href?: string;
  icon?: LucideIcon;
  children?: NavNode[];
  badge?: BadgeKey;
  /** Pro-only: shows a lock on Free and opens the Upgrade dialog */
  pro?: "customDomain";
  /** Extra path prefixes that count as this item (detail pages) */
  match?: string[];
  /** Shown in the bottom tab bar on phones */
  tab?: true;
}

/** Every address that belongs to the Store area (Store settings is under Settings). */
const STORE_MATCH = ["/store/{store}/design", "/store/{store}/pages", "/store/{store}/offers", "/store/{store}/reviews", "/store/{store}/questions", "/store/{store}/seo", "/store/{store}/analytics-tags"];

/**
 * What's inside the Store area: shown as tabs at the top of the Store pages (and found by search),
 * not as nested items in the sidebar.
 */
export const STORE_NAV: NavNode[] = [
  {
    id: "design", label: "Design", icon: Brush, children: [
      { id: "design-base", label: "Base design", href: "/store/{store}/design/base", match: ["/store/{store}/design/theme", "/store/{store}/design/sections", "/store/{store}/design/backgrounds", "/store/{store}/design/content"] },
      { id: "design-pages", label: "Pages", href: "/store/{store}/design/pages", match: ["/store/{store}/design/pages/"] },
    ],
  },
  {
    id: "info-pages", label: "Info pages", icon: FileText, children: [
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
    id: "seo-tools", label: "SEO", icon: Globe, children: [
      { id: "seo", label: "SEO", href: "/store/{store}/seo" },
      { id: "analytics-tags", label: "Analytics tags", href: "/store/{store}/analytics-tags" },
    ],
  },
];

export const CREATOR_NAV: NavNode[] = [
  // Getting started, operations and analytics are sections of the one dashboard
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, match: ["/getting-started"] },
  // The business flow, in order: Catalog (Collections, Products), Sales (Orders, Customers, Payouts),
  // then the Store's look and the rest. Store settings live under Settings.
  {
    id: "catalog", label: "Catalog", icon: Package, children: [
      { id: "collections", label: "Collections", href: "/catalog/collections", icon: FolderOpen, match: ["/catalog/collections/"] },
      { id: "products", label: "Products", href: "/catalog/products", icon: Package, badge: "products_all", match: ["/catalog/products/"] },
      { id: "bundles", label: "Bundles", href: "/catalog/bundles", icon: Box },
      { id: "deals", label: "Marketplace deals", href: "/catalog/deals", icon: Tag, match: ["/catalog/deals/"] },
      { id: "media", label: "Media library", href: "/catalog/media", icon: Images },
    ],
  },
  {
    id: "sales", label: "Sales", icon: Receipt, children: [
      { id: "orders", label: "Orders", href: "/sales/orders", icon: Receipt, badge: "orders_disputed", match: ["/sales/orders/"] },
      { id: "customers", label: "Customers", href: "/sales/customers", icon: Users, match: ["/sales/customers/"] },
      { id: "leads", label: "Leads", href: "/sales/leads", icon: Inbox, match: ["/sales/leads/"] },
      { id: "payouts", label: "Payouts", href: "/sales/payouts/balance", icon: Wallet, match: ["/sales/payouts/"] },
    ],
  },
  // Store is one plain item; its sections (Design, Info pages, Offers, Reviews, Domain and SEO) are tabs inside it
  { id: "store", label: "Store", href: "/store/{store}/design/base", icon: Store, match: STORE_MATCH },
  // Every live deal and offer across stores, with the price and units sold (a public page)
  { id: "marketplace", label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  {
    id: "tools", label: "Tools", icon: Wrench, children: [
      { id: "ai-images", label: "AI image maker", href: "/tools/ai-images", icon: Sparkles },
      { id: "integrations", label: "Integrations", href: "/tools/integrations", icon: Plug },
    ],
  },
  {
    id: "settings", label: "Settings", icon: Settings, children: [
      { id: "settings-store", label: "Store", href: "/store/{store}/settings", match: ["/store/{store}/settings"] },
      { id: "settings-domain", label: "Domain", href: "/store/{store}/domain", pro: "customDomain", match: ["/store/{store}/domain"] },
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
  { id: "a-products", label: "Products", href: "/admin/products", icon: Package },
  {
    id: "a-orders", label: "Orders", icon: Receipt, children: [
      { id: "a-orders-all", label: "All", href: "/admin/orders" },
      { id: "a-orders-disputed", label: "Disputed", href: "/admin/orders/disputed", badge: "disputes_open" },
    ],
  },
  {
    id: "a-money", label: "Money", icon: Banknote, children: [
      { id: "a-gateway", label: "Payment gateway", href: "/admin/money/gateway" },
      { id: "a-payouts", label: "Payouts", href: "/admin/money/payouts", badge: "payouts_open" },
      { id: "a-refunds", label: "Refunds", href: "/admin/money/refunds" },
    ],
  },
  {
    id: "a-moderation", label: "Moderation", icon: Shield, children: [
      { id: "a-flags", label: "Flags", href: "/admin/moderation/flags", icon: Flag, badge: "reports_open" },
      { id: "a-reviews", label: "Reviews", href: "/admin/moderation/reviews", icon: MessagesSquare },
      { id: "a-deals", label: "Marketplace deals", href: "/admin/moderation/deals", icon: Tag },
    ],
  },
  {
    id: "a-system", label: "System", icon: ScrollText, children: [
      { id: "a-audit", label: "Audit", href: "/admin/system/audit" },
      { id: "a-webhooks", label: "Webhooks", href: "/admin/system/webhooks" },
      { id: "a-team", label: "Team", href: "/admin/system/team" },
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
