"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useNav } from "@/components/nav/use-nav";
import { PageHeader } from "@/components/pp/page-header";
import { activeTrail } from "@/lib/nav/model";
import { InSettings } from "./in-settings";
import { cn } from "@/lib/utils";

/**
 * Settings as one row of tabs across the top, from the Settings section of the one nav config
 * (Part 7C). The same bar sits on every settings page, including Store and Domain, which live
 * under /store/[id]. Team members only see the tabs for the parts they work on.
 */
export function SettingsNav() {
  const pathname = usePathname() ?? "";
  const search = useSearchParams().toString();
  const { tree } = useNav("creator");
  const items = tree.find((n) => n.id === "settings")?.linkChildren ?? [];
  const active = activeTrail(items, pathname, search)[0]?.id;
  return (
    <nav aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
      {items.map((i) =>
        i.href ? (
          <Link
            key={i.id}
            href={i.href}
            aria-current={i.id === active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm font-semibold whitespace-nowrap hover:text-foreground",
              i.id === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            )}
          >
            {i.label}
          </Link>
        ) : null
      )}
    </nav>
  );
}

/** The Settings title and its tabs, around any settings page */
export function SettingsFrame({ children }: { children: React.ReactNode }) {
  return (
    <InSettings.Provider value>
      <PageHeader title="Settings" className="mb-4 md:mb-5" top />
      <Suspense fallback={<div className="mb-6 h-11 border-b" />}>
        <SettingsNav />
      </Suspense>
      {children}
    </InSettings.Provider>
  );
}
