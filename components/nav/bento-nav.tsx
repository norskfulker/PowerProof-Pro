"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { GLASS_TONES, type GlassTone } from "@/components/pp/glass-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeTrail, type ResolvedNode } from "@/lib/nav/model";
import { cn } from "@/lib/utils";

/** Tile order and each tile's colour (soft gradients from the icon-chip tones) */
const TILES: Record<string, GlassTone> = { dashboard: "emerald", analytics: "sky", agents: "amber", marketplace: "coral" };
const ORDER = Object.keys(TILES);

/** Where a tile goes: its own link, or the first page of its group */
const hrefOf = (n: ResolvedNode): string | undefined => n.href ?? n.children?.map(hrefOf).find(Boolean);

/** A tile's gradient: light tints of its tone over the surface, deeper when it's the open page */
function tileStyle(id: string, on: boolean): React.CSSProperties {
  const [a, b] = GLASS_TONES[TILES[id] ?? "slate"];
  const [ka, kb] = on ? [30, 16] : [18, 7];
  return {
    backgroundImage: `linear-gradient(140deg, color-mix(in oklab, ${a} ${ka}%, var(--surface)) 0%, color-mix(in oklab, ${b} ${kb}%, var(--surface)) 100%)`,
    borderColor: on ? `color-mix(in oklab, ${b} 45%, transparent)` : undefined,
  };
}

const iconColor = (id: string) => ({ color: `color-mix(in oklab, ${GLASS_TONES[TILES[id] ?? "slate"][1]} 80%, var(--foreground))` });

/**
 * Quick controls at the top of the sidebar: Dashboard, Analytics, Agents and Marketplace, two by
 * two on soft gradients. On the icon rail they stack as icons. The tiles come from the one nav
 * config (`bento: true`), so access rules and search treat them like any menu item.
 */
export function BentoNav({ tree, collapsed, onNavigate }: { tree: ResolvedNode[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const tiles = tree.filter((n) => n.bento).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const activeId = activeTrail(tree, pathname, search.toString())[0]?.id;
  if (!tiles.length) return null;

  if (collapsed) {
    return (
      <ul aria-label="Quick controls" className="flex flex-col items-center gap-1 px-2 pb-2">
        {tiles.map((n) => {
          const Icon = n.icon;
          const href = hrefOf(n);
          if (!href || !Icon) return null;
          const on = n.id === activeId;
          return (
            <li key={n.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={href} onClick={onNavigate} aria-label={n.label} aria-current={on ? "page" : undefined} style={tileStyle(n.id, on)} className="grid size-11 place-items-center rounded-control border border-transparent">
                    <Icon className="size-[18px]" style={iconColor(n.id)} strokeWidth={1.75} aria-hidden />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{n.label}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul aria-label="Quick controls" className="grid grid-cols-2 gap-2 px-3 pb-3">
      {tiles.map((n) => {
        const Icon = n.icon;
        const href = hrefOf(n);
        if (!href) return null;
        const on = n.id === activeId;
        return (
          <li key={n.id}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={on ? "page" : undefined}
              style={tileStyle(n.id, on)}
              className={cn("flex h-full min-h-[4.25rem] flex-col justify-between gap-2 rounded-card border p-3 transition-[filter,border-color]", "hover:brightness-[0.97] dark:hover:brightness-110")}
            >
              {Icon && <Icon className="size-[18px] shrink-0" style={iconColor(n.id)} strokeWidth={1.75} aria-hidden />}
              <span className="truncate text-sm font-semibold">{n.label}</span>
              {n.count !== undefined && <span className="sr-only">{n.count} {n.badgeLabel}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
