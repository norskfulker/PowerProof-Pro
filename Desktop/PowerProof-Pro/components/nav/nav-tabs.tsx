"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNav } from "@/components/nav/use-nav";
import type { ResolvedNode } from "@/lib/nav/model";
import { cn } from "@/lib/utils";

const firstLink = (n: ResolvedNode): string | undefined => n.href ?? n.children?.map(firstLink).find(Boolean);

/** A row of tabs from nav nodes: underlined, or small pills for a second row */
export function NavTabs({ nodes, active, label, small }: { nodes: ResolvedNode[]; active?: string; label: string; small?: boolean }) {
  return (
    <nav aria-label={label} className={cn("flex gap-1 overflow-x-auto", small ? "mb-5" : "mb-3 border-b")}>
      {nodes.map((n) => {
        const href = firstLink(n);
        const on = n.id === active;
        if (!href) return null;
        return (
          <Link
            key={n.id}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold whitespace-nowrap",
              small ? "rounded-full px-3.5 hover:bg-muted" : "-mb-px border-b-2 px-4 hover:text-foreground",
              small ? (on ? "bg-primary-soft text-primary" : "text-muted-foreground") : on ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            )}
          >
            {n.label}
            {n.count !== undefined && <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6875rem]">{n.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Analytics and the store's data (Orders, Customers, Leads, Payouts) as one row of tabs, from the
 * Analytics group of the menu. Shown on those list pages, not on a single order or customer.
 */
export function AnalyticsTabs() {
  const { tree } = useNav("creator");
  const path = usePathname();
  const tabs = tree.find((n) => n.id === "analytics")?.children ?? [];
  const on = tabs.find((t) => t.href === path || (t.id === "payouts" && path.startsWith("/sales/payouts")));
  if (!on || tabs.length < 2) return null;
  return <NavTabs nodes={tabs} active={on.id} label="Analytics and store data" />;
}
