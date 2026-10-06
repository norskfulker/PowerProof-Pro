"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useNavTrail } from "@/components/nav/use-nav";
import { cn } from "@/lib/utils";

/**
 * Breadcrumbs from the nav tree (Part 7C), so they always mirror the menu: Catalog › Products › Live.
 * Detail pages pass `current` for the last crumb (a product's title, an order number).
 */
export function Breadcrumbs({ current, area = "creator", className }: { current?: string; area?: "creator" | "admin"; className?: string }) {
  const trail = useNavTrail(area);
  if (!trail.length) return null;
  const crumbs = current ? [...trail.map((n) => ({ label: n.label, href: n.href })), { label: current, href: undefined }] : trail.map((n, i) => ({ label: n.label, href: i === trail.length - 1 ? undefined : n.href }));
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-2", className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-muted-foreground">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="inline-flex min-h-8 items-center rounded-xs hover:text-foreground hover:underline pointer-coarse:min-h-11">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "font-medium text-foreground")}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
