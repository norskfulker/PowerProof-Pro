"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, CREATOR_NAV, STORE_NAV } from "@/lib/nav/config";
import { activeTrail, resolveNav } from "@/lib/nav/model";

/**
 * Where this page sits in the menu, above its title ("Store Data · Orders"), from the one nav
 * config. Top-level pages (Dashboard) have none. Labels only: the sidebar is the way to move.
 */
export function PageCrumbs({ title }: { title?: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const crumbs = useMemo(() => {
    const admin = pathname.startsWith("/admin");
    const storeId = pathname.match(/^\/store\/([^/]+)/)?.[1] ?? "current";
    const data = { storeId, counts: {}, locked: new Set<"customDomain">() };
    const tree = admin ? resolveNav(ADMIN_NAV, data) : [...resolveNav(CREATOR_NAV, data), { id: "store-area", label: "Store settings", path: ["Store settings"], children: resolveNav(STORE_NAV, data, ["Store settings"]) }];
    const trail = activeTrail(tree, pathname).map((n) => n.label);
    // The page's own name is its title; show only where it sits. When the title already names the
    // section (Settings, Your products), its tabs or menu say the rest, so nothing is shown.
    if (trail.length < 2 || (typeof title === "string" && trail[0] === title)) return [];
    if (typeof title === "string" && trail.at(-1) === title) trail.pop();
    return trail;
  }, [pathname, title]);
  if (!crumbs.length) return null;
  return (
    <p className="eyebrow mb-2 flex flex-wrap items-center gap-1.5" aria-label="You are in">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {c}
        </span>
      ))}
    </p>
  );
}
