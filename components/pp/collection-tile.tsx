"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TileBackgroundView } from "@/components/media/tile-background";
import { useImageAverage } from "@/hooks/use-image-average";
import { tileTextColor } from "@/lib/media/contrast";
import type { Collection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CoverArt } from "./product-cover";

/** The tile picture: the creator's colour or image if set, otherwise the generated cover. */
export function CollectionTileArt({ collection, size = "sm", className }: { collection: Pick<Collection, "name" | "cover" | "background">; size?: "xs" | "sm"; className?: string }) {
  const bg = collection.background;
  const avg = useImageAverage(bg?.kind === "image" ? bg.src : undefined);
  if (bg && (bg.kind === "color" || bg.src)) {
    return (
      <TileBackgroundView bg={bg} label={collection.name} className={cn("@container flex aspect-[4/3] w-full items-end rounded-media", size === "xs" ? "p-2" : "p-3", className)}>
        {size !== "xs" && (
          <span aria-hidden className="line-clamp-2 font-display text-[clamp(0.875rem,9cqw,1.25rem)] leading-tight font-extrabold [overflow-wrap:anywhere]" style={{ color: tileTextColor(bg, avg) }}>
            {collection.name}
          </span>
        )}
      </TileBackgroundView>
    );
  }
  return <CoverArt cover={{ ...collection.cover, title: collection.name || collection.cover.title, subtitle: undefined }} size={size} className={className} />;
}

export function CollectionTile({ collection, href }: { collection: Collection; href: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-card border bg-surface p-3 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-border-strong">
      <CollectionTileArt collection={collection} />
      <span className="flex items-center justify-between gap-2 px-1 pb-1">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{collection.name}</span>
          <span className="block text-xs text-muted-foreground">{collection.productIds.length} product{collection.productIds.length === 1 ? "" : "s"}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}
