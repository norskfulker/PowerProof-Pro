"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useNav } from "@/components/nav/use-nav";
import { activeTrail, type ResolvedNode } from "@/lib/nav/model";
import { cn } from "@/lib/utils";

const firstLink = (n: ResolvedNode): string | undefined => n.href ?? n.children?.map(firstLink).find(Boolean);

function Row({ nodes, active, label, small }: { nodes: ResolvedNode[]; active?: string; label: string; small?: boolean }) {
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
 * The Store area is one place in the sidebar; what's inside it (Design, Policies, Offers and SEO) is
 * a row of tabs here, with a second row for the parts of the open one. Pages, About and FAQ,
 * reviews and questions are panels of the store editor (Design).
 */
export function StoreTabs() {
  const { storeTabs } = useNav("creator");
  const path = usePathname();
  const search = useSearchParams().toString();
  const trail = activeTrail(storeTabs, path, search);
  const group = trail[0];
  const sub = group?.children?.filter((c) => c.href && !c.inEditor);
  return (
    <div data-slot="store-tabs">
      <Row nodes={storeTabs} active={group?.id} label="Store" />
      {sub && sub.length > 1 && <Row nodes={sub} active={trail[1]?.id} label={`${group.label} sections`} small />}
    </div>
  );
}
