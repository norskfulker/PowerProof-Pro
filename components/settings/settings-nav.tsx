"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentStore } from "@/hooks/use-current-store";
import { CREATOR_NAV } from "@/lib/nav/config";
import { can } from "@/lib/team";
import { cn } from "@/lib/utils";

// The Settings section of the one nav config (Part 7C)
// Store settings and Domain live on store pages; "current" is turned into the real store id there
const SETTINGS = CREATOR_NAV.find((n) => n.id === "settings")!.children!.map((n) => ({ href: n.href!.replace("{store}", "current"), label: n.label, need: n.need ?? "any" }));

export function SettingsNav() {
  const pathname = usePathname();
  // Team members see the settings for the parts of the store they work on
  const access = useCurrentStore().data?.access;
  return (
    <nav aria-label="Settings" className="-mx-[16px] overflow-x-auto px-[16px] lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-2 lg:gap-1 lg:sticky lg:top-24 lg:flex-col lg:pointer-coarse:gap-2">
        {SETTINGS.filter((i) => can(access, i.need)).map((i) => {
          const active = pathname === i.href;
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-control px-3 text-sm font-medium whitespace-nowrap lg:min-h-10 lg:pointer-coarse:min-h-11",
                  active ? "bg-primary-soft text-primary" : "text-foreground/80 hover:bg-muted"
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
