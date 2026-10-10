"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getActiveStoreId } from "@/lib/api";
import { ADMIN_TABS, MOBILE_TABS, type TabItem } from "@/lib/nav/config";
import { can, needForPath } from "@/lib/team";
import { cn } from "@/lib/utils";

/** The longest matching prefix wins, so /admin/orders lights Disputes, not Overview. */
export function activeTab(tabs: TabItem[], pathname: string): TabItem | undefined {
  let best: { t: TabItem; len: number } | undefined;
  for (const t of tabs)
    for (const m of t.match)
      if ((pathname === m || pathname.startsWith(m + "/")) && (!best || m.length > best.len)) best = { t, len: m.length };
  return best?.t;
}

export function MobileTabBar({ area, onMore }: { area: "creator" | "admin"; onMore: () => void }) {
  const pathname = usePathname();
  const store = useApi(getActiveStoreId, []);
  const access = useCurrentStore().data?.access;
  // Team members only get the tabs for the parts of the store they work on
  const tabs = area === "admin" ? ADMIN_TABS : MOBILE_TABS.filter((t) => can(access, needForPath(t.href)));
  const active = activeTab(tabs, pathname);
  return (
    <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid auto-cols-fr grid-flow-col">
        {tabs.map((t) => {
          const on = t === active;
          const Icon = t.icon;
          return (
            <li key={t.label} className="min-w-0">
              <Link
                href={t.href.replace("{store}", store.data ?? "current")}
                aria-current={on ? "page" : undefined}
                className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium", on ? "text-primary" : "text-muted-foreground")}
              >
                <span className={cn("grid h-7 w-full max-w-12 place-items-center rounded-full transition-colors", on && "bg-primary-soft")}>
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="max-w-full truncate px-0.5">{t.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <button type="button" onClick={onMore} className="flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground" aria-haspopup="dialog">
            <span className="grid h-7 w-full max-w-12 place-items-center">
              <Menu className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="max-w-full truncate px-0.5">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
