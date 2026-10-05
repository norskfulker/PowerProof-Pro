"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MobileTabBar } from "./mobile-tab-bar";
import { ADMIN_NAV, ADMIN_TABS, CREATOR_NAV, MOBILE_TABS } from "./nav-config";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-control bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to content
    </a>
  );
}

export function AppShell({ children, variant = "creator" }: { children: React.ReactNode; variant?: "creator" | "admin" }) {
  const [more, setMore] = useState(false);
  const admin = variant === "admin";
  const groups = admin ? ADMIN_NAV : CREATOR_NAV;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <SkipLink />
      <aside className={cn("sticky top-0 hidden h-dvh border-r md:block", admin && "border-transparent")}>
        <SidebarNav groups={groups} tone={admin ? "admin" : "light"} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <Topbar admin={admin} />
        <main id="main" tabIndex={-1} className="gutter mx-auto w-full max-w-[1280px] flex-1 pt-6 pb-28 outline-none md:pt-8 md:pb-16">
          {children}
        </main>
      </div>
      <MobileTabBar tabs={admin ? ADMIN_TABS : MOBILE_TABS} onMore={() => setMore(true)} />
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="left" className="w-[86vw] max-w-xs p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarNav groups={groups} tone={admin ? "admin" : "light"} onNavigate={() => setMore(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
