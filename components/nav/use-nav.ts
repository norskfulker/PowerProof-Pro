"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { usePlan } from "@/components/plan/plan-context";
import { useApi } from "@/hooks/use-api";
import { getNavCounts } from "@/lib/api";
import { ADMIN_NAV, CREATOR_NAV } from "@/lib/nav/config";
import { activeTrail, resolveNav, type ResolvedNode } from "@/lib/nav/model";

/** The resolved menu for an area: live counts, collections, the active store id and Pro locks. */
export function useNav(area: "creator" | "admin"): { tree: ResolvedNode[] } {
  const plan = usePlan();
  const { data } = useApi(() => getNavCounts(area), [area], { live: true });
  // Until the plan loads, nothing is locked (the server still refuses what the plan doesn't allow)
  const domainOk = plan.state?.limits.customDomain ?? true;
  const tree = useMemo(
    () =>
      resolveNav(area === "admin" ? ADMIN_NAV : CREATOR_NAV, {
        storeId: data?.storeId ?? "current",
        counts: data?.counts ?? {},
        collections: data?.collections ?? [],
        locked: new Set(domainOk ? [] : (["customDomain"] as const)),
      }),
    [area, data, domainOk]
  );
  return { tree };
}

/** Where the current page sits in the menu (breadcrumbs, page titles). */
export function useNavTrail(area: "creator" | "admin" = "creator"): ResolvedNode[] {
  const { tree } = useNav(area);
  const pathname = usePathname();
  const search = useSearchParams();
  return useMemo(() => activeTrail(tree, pathname, search.toString()), [tree, pathname, search]);
}
