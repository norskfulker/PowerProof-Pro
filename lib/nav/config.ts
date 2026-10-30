import {
  Activity, AlertOctagon, Banknote, BarChart3, Bot, Box, Cable, Brush, CreditCard, FileText, Flag, FolderOpen, Globe, Images, Inbox, LayoutDashboard, MessagesSquare,
  Newspaper, Package, Plug, Receipt, ScrollText, Search, Settings, Shield, ShoppingBag, Store, Tag, Ticket, Users, Wallet, Wrench, type LucideIcon,
} from "lucide-react";
import type { Need } from "../team";

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
  /** A panel of the store editor: found by search (with its badge), not shown as a tab */
  inEditor?: true;
  /** Who on the workspace's team can open it (lib/team.ts); children inherit it. Default: everyone. */
  need?: Need;
  /** Only once the store has physical shipping turned on (SKUs) */
  physical?: true;
  /** A quick-control tile at the top of the sidebar instead of a row in the list */
  bento?: true;
  /** At the bottom of the sidebar, under Notifications */
  footer?: true;
  /** A group shown in the sidebar as one link to its first page (its pages stay searchable) */
  asLink?: true;
}

/** The store designer: My Store in the sidebar (reviews and questions open as its panels) */
const STORE_MATCH = ["/store/{store}/design", "/store/{store}/reviews", "/store/{store}/questions"];
/** Settings › Store: the store's details plus its Policies, Offers and SEO tabs */
const STORE_SETTINGS_MATCH = ["/store/{store}/settings", "/store/{store}/pages", "/store/{store}/offers", "/store/{store}/seo", "/store/{store}/analytics-tags"];

/**
 * Settings › Store, as tabs across the top of its pages (and found by search): General, Policies,
 * Offers and SEO. Design is the store editor itself (My Store); it stays here so search finds its
 * panels, but isn't a tab.
 */
const EDITOR = "/store/{store}/design/pages/home/edit";

export const STORE_NAV: NavNode[] = [
  { id: "store-general", label: "General", href: "/store/{store}/settings", need: "business" },
  {
    // Pages and FAQ are panels of the store editor, beside the pages that show them
    id: "design", label: "Design", icon: Brush, need: "design", children: [
      { id: "design-base", label: "Theme editor", href: EDITOR, match: ["/store/{store}/design/pages/", "/store/{store}/design/theme", "/store/{store}/design/sections", "/store/{store}/design/backgrounds", "/store/{store}/design/content"] },
      { id: "design-pages", label: "Pages", href: `${EDITOR}?panel=pages`, inEditor: true },
      { id: "pages-faq", label: "FAQ", href: `${EDITOR}?panel=faq`, inEditor: true },
    ],
  },
  {
    id: "policies", label: "Policies", icon: FileText, need: "design", children: [
      { id: "policy-refund", label: "Refund", href: "/store/{store}/pages/policies/refund" },
      { id: "policy-terms", label: "Terms", href: "/store/{store}/pages/policies/terms" },
      { id: "policy-privacy", label: "Privacy", href: "/store/{store}/pages/policies/privacy" },
      // Store content, edited in the store editor beside the page
      { id: "pages-about", label: "About", href: `${EDITOR}?panel=about` },
      { id: "reviews", label: "Reviews", href: `${EDITOR}?panel=reviews`, badge: "reviews_pending" },
      { id: "questions", label: "Questions", href: `${EDITOR}?panel=questions`, badge: "questions_open" },
    ],
  },
  {
    id: "offers", label: "Offers", icon: Ticket, need: "marketing", children: [
      { id: "offers-coupons", label: "Coupons", href: "/store/{store}/offers/coupons" },
      { id: "offers-bundles", label: "Bundles", href: "/store/{store}/offers/bundles" },
      { id: "offers-deal-paths", label: "Deal Paths", href: "/store/{store}/offers/deal-paths", match: ["/store/{store}/offers/deal-paths/"] },
      { id: "offers-deals", label: "Limited-time deals", href: "/store/{store}/offers/deals" },
    ],
  },
  {
    id: "seo-tools", label: "SEO", icon: Globe, need: "design", children: [
      { id: "seo", label: "SEO", href: "/store/{store}/seo" },
      { id: "analytics-tags", label: "Analytics tags", href: "/store/{store}/analytics-tags" },
    ],
  },
];

export const CREATOR_NAV: NavNode[] = [
  // Quick controls at the top of the sidebar: Dashboard and Analytics tiles, then one Marketplace card
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, match: ["/getting-started"], bento: true },
  // Sales, buyers, products and visitors in detail
  { id: "analytics", label: "Analytics", href: "/analytics", icon: BarChart3, need: "analytics", bento: true },
  // Agents and deals in one card: browse the marketplace, or open this workspace's subscribed agents
  // (their send queue and connections count as them)
  {
    id: "marketplace", label: "Marketplace", icon: ShoppingBag, bento: true, children: [
      { id: "marketplace-browse", label: "Browse", href: "/marketplace", icon: ShoppingBag, match: ["/marketplace/agents/"] },
      { id: "agents", label: "Subscribed agents", href: "/marketplace?tab=subscribed", icon: Bot, match: ["/agents/my"], need: "agents" },
    ],
  },
  // The list: Your products, then the Store with its data nested under it
  {
    id: "catalog", label: "Your products", icon: Package, children: [
      { id: "collections", label: "Collections", href: "/catalog/collections", icon: FolderOpen, match: ["/catalog/collections/"], need: "catalog" },
      { id: "products", label: "Products", href: "/catalog/products", icon: Package, badge: "products_all", match: ["/catalog/products/"], need: "catalog" },
      { id: "bundles", label: "Bundles", href: "/catalog/bundles", icon: Box, need: "marketing" },
      { id: "media", label: "Media library", href: "/catalog/media", icon: Images, need: "catalog" },
    ],
  },
  // The store asks how to build: Create with AI (AI Studio), Create custom (the editor) or Copy a store.
  // Policies, Offers and SEO are tabs of Settings › Store. Its orders, payments, live activity,
  // customers, leads and payouts sit under it.
  {
    id: "store", label: "Store", icon: Store, children: [
      { id: "store-design", label: "Design", href: "/store/{store}/design", icon: Brush, match: STORE_MATCH, need: "design" },
      { id: "orders", label: "Orders", href: "/sales/orders", icon: Receipt, badge: "orders_disputed", match: ["/sales/orders/"], need: "orders" },
      { id: "payments", label: "Payments", href: "/sales/payments", icon: CreditCard, need: "orders" },
      { id: "activity", label: "Live activity", href: "/sales/activity", icon: Activity, need: "orders" },
      { id: "customers", label: "Customers", href: "/sales/customers", icon: Users, match: ["/sales/customers/"], need: "orders" },
      { id: "leads", label: "Leads", href: "/sales/leads", icon: Inbox, match: ["/sales/leads/"], need: "orders" },
      { id: "payouts", label: "Payouts", href: "/sales/payouts/balance", icon: Wallet, match: ["/sales/payouts/"], need: "owner" },
    ],
  },
  // Tools and Settings sit together at the bottom of the sidebar, under Notifications
  {
    id: "tools", label: "Tools", icon: Wrench, need: "design", footer: true, children: [
      { id: "integrations", label: "Integrations", href: "/tools/integrations", icon: Plug },
      // The accounts agents use (Google Sheets and the like), shared by every agent
      { id: "connectors", label: "Connectors", href: "/agents/my/connections", icon: Cable, need: "agents" },
    ],
  },
  {
    // One link at the bottom of the sidebar: opens the first settings page the person can see;
    // the pages are tabs of Settings
    id: "settings", label: "Settings", icon: Settings, footer: true, asLink: true, children: [
      { id: "settings-store", label: "Store", href: "/store/{store}/settings", match: STORE_SETTINGS_MATCH, need: "business" },
      { id: "settings-profile", label: "Profile", href: "/settings/profile" },
      { id: "settings-company", label: "Company and invoices", href: "/settings/company", need: "business" },
      // HSN/SAC codes appear here once physical shipping is on; invoice numbering is always here
      { id: "settings-tax", label: "Tax and invoices", href: "/settings/tax", need: "business" },
      { id: "settings-skus", label: "SKUs", href: "/settings/skus", need: "catalog", physical: true },
      { id: "settings-billing", label: "Billing and plan", href: "/settings/billing", need: "owner" },
      { id: "settings-team", label: "Team", href: "/settings/team" },
    ],
  },
];

export const ADMIN_NAV: NavNode[] = [
  { id: "a-overview", label: "Overview", href: "/admin", icon: LayoutDashboard },
  { id: "a-creators", label: "Creators", href: "/admin/creators", icon: Users },
  { id: "a-stores", label: "Stores", href: "/admin/stores", icon: Store },
  { id: "a-products", label: "Products", href: "/admin/products", icon: Package },
  { id: "a-blog", label: "Blog", href: "/admin/blog", icon: Newspaper },
  { id: "a-agents", label: "Agents", href: "/admin/agents", icon: Bot, match: ["/admin/agents/"] },
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
