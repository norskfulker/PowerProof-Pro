"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { NavTabs as Row } from "@/components/nav/nav-tabs";
import { useNav } from "@/components/nav/use-nav";
import { activeTrail } from "@/lib/nav/model";

/**
 * Settings › Store as a row of tabs (General, Policies, Offers, SEO), with a second row for the
 * parts of the open one. The store's look is edited in My Store (the store editor).
 */
export function StoreTabs() {
  const { storeTabs: all } = useNav("creator");
  // Design is the store editor (My Store), not a settings tab
  const storeTabs = all.filter((t) => t.id !== "design");
  const path = usePathname();
  const search = useSearchParams().toString();
  const trail = activeTrail(storeTabs, path, search);
  const group = trail[0];
  const sub = group?.children?.filter((c) => c.href && !c.inEditor);
  return (
    <div data-slot="store-tabs">
      <Row nodes={storeTabs} active={group?.id} label="Store settings" />
      {sub && sub.length > 1 && <Row nodes={sub} active={trail[1]?.id} label={`${group.label} sections`} small />}
    </div>
  );
}
