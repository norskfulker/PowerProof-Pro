import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Collection } from "@/lib/types";
import { CoverArt } from "./product-cover";

export function CollectionTile({ collection, href }: { collection: Collection; href: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-card border bg-surface p-3 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-border-strong">
      <CoverArt cover={{ ...collection.cover, subtitle: undefined }} size="sm" />
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
