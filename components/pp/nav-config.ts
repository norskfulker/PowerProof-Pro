import {
  AlertOctagon,
  BarChart3,
  Banknote,
  Box,
  Flag,
  Image as ImageIcon,
  LayoutDashboard,
  MonitorPlay,
  Package,
  PanelsTopLeft,
  Plug,
  Receipt,
  Settings,
  Store,
  Truck,
  Users,
  Wallet,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match child routes too */
  match?: string;
  soon?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const CREATOR_NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/products", label: "Products", icon: Package, match: "/products" },
      { href: "/images", label: "Image maker", icon: ImageIcon },
      { href: "/pages", label: "Pages", icon: PanelsTopLeft, match: "/pages" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/orders", label: "Orders", icon: Receipt, match: "/orders" },
      { href: "/customers", label: "Customers", icon: Users, match: "/customers" },
      { href: "/payouts", label: "Payouts", icon: Wallet },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Store",
    items: [
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/settings/profile", label: "Settings", icon: Settings, match: "/settings" },
    ],
  },
  {
    label: "Coming later",
    items: [
      { href: "#", label: "Webinars", icon: MonitorPlay, soon: true },
      { href: "#", label: "Courses", icon: GraduationCap, soon: true },
      { href: "#", label: "Physical items", icon: Truck, soon: true },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package, match: "/products" },
  { href: "/orders", label: "Orders", icon: Receipt, match: "/orders" },
  { href: "/payouts", label: "Payouts", icon: Wallet },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/creators", label: "Creators", icon: Store },
      { href: "/admin/orders", label: "Orders", icon: Receipt },
      { href: "/admin/disputes", label: "Disputes", icon: AlertOctagon },
      { href: "/admin/payouts", label: "Payouts queue", icon: Banknote },
      { href: "/admin/flags", label: "Flagged content", icon: Flag },
    ],
  },
  { label: "Switch", items: [{ href: "/dashboard", label: "Creator app", icon: Box }] },
];

export const ADMIN_TABS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/creators", label: "Creators", icon: Store },
  { href: "/admin/disputes", label: "Disputes", icon: AlertOctagon },
  { href: "/admin/payouts", label: "Payouts", icon: Banknote },
];

export const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/store", label: "Store branding" },
  { href: "/settings/company", label: "Company" },
  { href: "/settings/tax", label: "Tax and invoices" },
  { href: "/settings/skus", label: "SKUs" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/billing", label: "Billing and plan" },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.match) return pathname === item.match || pathname.startsWith(item.match + "/");
  return pathname === item.href;
}
