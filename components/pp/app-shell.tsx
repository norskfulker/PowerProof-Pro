"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarProgress } from "@/components/getting-started/getting-started-card";
import { NavTree } from "@/components/nav/nav-tree";
import { useNav } from "@/components/nav/use-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CreatorProviders } from "./creator-providers";
import { Logo } from "./logo";
import { MobileTabBar } from "./mobile-tab-bar";
import { Topbar } from "./topbar";

const RAIL_KEY = "pp:nav-rail";
const railListeners = new Set<() => void>();
function readRail() {
  try {
    return localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false;
  }
}
function setRail(v: boolean) {
  try {
    localStorage.setItem(RAIL_KEY, v ? "1" : "0");
  } catch {
    /* storage blocked */
  }
  railListeners.forEach((l) => l());
}

export function SkipLink() {
  return (
    <a href="#main" className="sr-only z-50 rounded-control bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
      Skip to content
    </a>
  );
}

function Sidebar({ admin, collapsed, onToggle, onNavigate, footer }: { admin: boolean; collapsed?: boolean; onToggle?: () => void; onNavigate?: () => void; footer?: React.ReactNode }) {
  const nav = useNav(admin ? "admin" : "creator");
  return (
    <div className={cn("flex h-full flex-col", admin ? "bg-sidebar-admin text-sidebar-admin-foreground" : "bg-surface")}>
      <div className={cn("flex h-16 shrink-0 items-center gap-2", collapsed ? "justify-center px-2" : "px-5")}>
        {!collapsed && <Logo href={admin ? "/admin" : "/dashboard"} inverted={admin} />}
        {admin && !collapsed && <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[0.625rem] font-semibold text-accent-foreground uppercase">Admin</span>}
        {onToggle && (
          <Button variant="ghost" size="icon-sm" onClick={onToggle} className={cn(!collapsed && "ml-auto", admin && "text-sidebar-admin-foreground hover:bg-sidebar-admin-foreground/10")} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar to icons"} aria-expanded={!collapsed}>
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
        )}
      </div>
      <Suspense>
        <NavTree tree={nav.tree} area={admin ? "admin" : "creator"} tone={admin ? "admin" : "light"} collapsed={collapsed} onNavigate={onNavigate} onExpandRail={collapsed ? onToggle : undefined} />
      </Suspense>
      {footer && !collapsed && <div className="shrink-0 border-t border-current/10 p-3">{footer}</div>}
    </div>
  );
}

export function AppShell({ children, variant = "creator" }: { children: React.ReactNode; variant?: "creator" | "admin" }) {
  const [more, setMore] = useState(false);
  const admin = variant === "admin";
  const rail = useSyncExternalStore((cb) => (railListeners.add(cb), () => railListeners.delete(cb)), readRail, () => false);
  const footer = admin ? undefined : <SidebarProgress />;
  return (
    <CreatorProviders tracker={!admin}>
      <div className={cn("min-h-dvh md:grid", rail ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[272px_minmax(0,1fr)]")}>
        <SkipLink />
        <aside className={cn("sticky top-0 hidden h-dvh border-r md:block", admin && "border-transparent")}>
          <Sidebar admin={admin} collapsed={rail} onToggle={() => setRail(!rail)} footer={footer} />
        </aside>
        <div className="flex min-w-0 flex-col">
          <Topbar admin={admin} />
          <main id="main" tabIndex={-1} className="gutter mx-auto w-full max-w-[1280px] flex-1 pt-6 pb-28 outline-none md:pt-8 md:pb-16">
            {children}
          </main>
        </div>
        <MobileTabBar area={admin ? "admin" : "creator"} onMore={() => setMore(true)} />
        <Sheet open={more} onOpenChange={setMore}>
          <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Sidebar admin={admin} onNavigate={() => setMore(false)} footer={footer} />
          </SheetContent>
        </Sheet>
      </div>
    </CreatorProviders>
  );
}
