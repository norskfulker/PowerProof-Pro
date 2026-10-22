"use client";

import { useMemo } from "react";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getNavCounts } from "@/lib/api";
import { ADMIN_NAV, CREATOR_NAV, STORE_NAV } from "@/lib/nav/config";
import { resolveNav, type ResolvedNode } from "@/lib/nav/model";
import { sellsKind } from "@/lib/shipping";

/** The resolved menu for an area: live counts, the active store id and Pro locks. */
export function useNav(area: "creator" | "admin"): { tree: ResolvedNode[]; storeTabs: ResolvedNode[] } {
  const { data } = useApi(() => getNavCounts(area), [area], { live: true });
  // Team members see only the parts of the store they work on
  const store = useCurrentStore().data;
  const access = store?.access;
  const physical = sellsKind(store?.sells, "physical");
  const { tree, storeTabs } = useMemo(() => {
    const nav = {
      storeId: data?.storeId ?? "current",
      counts: data?.counts ?? {},
      access: area === "admin" ? undefined : access,
      physical,
    };
    return {
      tree: resolveNav(area === "admin" ? ADMIN_NAV : CREATOR_NAV, nav),
      // The Store area's tabs: not in the sidebar, but shown across the top of the Store pages and found by search
      storeTabs: area === "admin" ? [] : resolveNav(STORE_NAV, nav, ["My Store"]),
    };
  }, [area, data, access, physical]);
  return { tree, storeTabs };
}
