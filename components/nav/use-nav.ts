"use client";

import { useMemo } from "react";
import { usePlan } from "@/components/plan/plan-context";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getNavCounts } from "@/lib/api";
import { ADMIN_NAV, CREATOR_NAV, STORE_NAV } from "@/lib/nav/config";
import { resolveNav, type ResolvedNode } from "@/lib/nav/model";

/** The resolved menu for an area: live counts, the active store id and Pro locks. */
export function useNav(area: "creator" | "admin"): { tree: ResolvedNode[]; storeTabs: ResolvedNode[] } {
  const plan = usePlan();
  const { data } = useApi(() => getNavCounts(area), [area], { live: true });
  // Team members see only the parts of the store they work on
  const access = useCurrentStore().data?.access;
  // Until the plan loads, nothing is locked (the server still refuses what the plan doesn't allow)
  const domainOk = plan.state?.limits.customDomain ?? true;
  const { tree, storeTabs } = useMemo(() => {
    const nav = {
      storeId: data?.storeId ?? "current",
      counts: data?.counts ?? {},
      locked: new Set(domainOk ? [] : (["customDomain"] as const)),
      access: area === "admin" ? undefined : access,
    };
    return {
      tree: resolveNav(area === "admin" ? ADMIN_NAV : CREATOR_NAV, nav),
      // The Store area's tabs: not in the sidebar, but shown across the top of the Store pages and found by search
      storeTabs: area === "admin" ? [] : resolveNav(STORE_NAV, nav, ["Store"]),
    };
  }, [area, data, domainOk, access]);
  return { tree, storeTabs };
}
