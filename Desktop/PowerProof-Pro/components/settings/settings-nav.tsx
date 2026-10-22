"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCurrentStore } from "@/hooks/use-current-store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CREATOR_NAV } from "@/lib/nav/config";
import { can } from "@/lib/team";
import { sellsKind } from "@/lib/shipping";

// The Settings section of the one nav config (Part 7C)
// Store settings and Domain live on store pages; "current" is turned into the real store id there
const SETTINGS = CREATOR_NAV.find((n) => n.id === "settings")!.children!.map((n) => ({ href: n.href!.replace("{store}", "current"), label: n.label, need: n.need ?? "any", physical: !!n.physical }));

/**
 * Settings as one row of tabs across the top. Every section is its own page, so nothing is nested
 * inside a page — this tab bar is the only level of navigation.
 */
export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  // Team members see the settings for the parts of the store they work on
  const store = useCurrentStore().data;
  const access = store?.access;
  // SKUs come with physical shipping
  const items = SETTINGS.filter((i) => can(access, i.need) && (!i.physical || sellsKind(store?.sells, "physical")));
  return (
    <Tabs value={items.some((i) => i.href === pathname) ? pathname : items[0].href} onValueChange={(href) => router.push(href)}>
      <TabsList aria-label="Settings sections" className="max-w-full justify-start overflow-x-auto">
        {items.map((i) => (
          <TabsTrigger key={i.href} value={i.href}>
            {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
