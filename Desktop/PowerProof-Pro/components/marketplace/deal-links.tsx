"use client";

import Link from "next/link";
import { Copy, LayoutTemplate } from "lucide-react";
import { CopyField, copyText } from "@/components/pp/copy-field";
import { Button } from "@/components/ui/button";
import type { Deal } from "@/lib/api";

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/**
 * Under a marketplace card: the product's direct link (open or copy), and Copy this site, which
 * copies the seller's site into your store and puts it live in one click. The copy link can be
 * shared too: anyone signed in who opens it gets their own copy.
 */
export function DealLinks({ d }: { d: Pick<Deal, "storeSlug" | "productSlug" | "storeName" | "title"> }) {
  const path = `/s/${d.storeSlug}/${d.productSlug}`;
  const copyPath = `/marketplace/copy/${encodeURIComponent(d.storeSlug)}`;
  return (
    <div className="flex flex-col gap-2 border-t p-3">
      <CopyField value={`${origin()}${path}`} display={path} toastText="Product link copied" />
      <div className="flex gap-2">
        <Button asChild variant="secondary" size="sm" className="flex-1">
          <Link href={copyPath} aria-label={`Copy ${d.storeName}'s site into your store and put it live`}>
            <LayoutTemplate aria-hidden /> Copy this site
          </Link>
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Copy the link that copies ${d.storeName}'s site`} title="Copy the copy-site link to share" onClick={() => copyText(`${origin()}${copyPath}`, "Copy-site link copied")}>
          <Copy aria-hidden />
        </Button>
      </div>
    </div>
  );
}
