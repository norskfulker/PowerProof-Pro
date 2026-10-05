"use client";

import Link from "next/link";
import { GuardedLink } from "@/components/plan/plan-context";
import { ArrowUpRight, Link2, Plus, Wallet } from "lucide-react";
import { copyText } from "@/components/pp/copy-field";
import { markLinkShared } from "@/lib/api";
import { SITE_URL } from "@/lib/format";
import type { Store } from "@/lib/types";

const tile =
  "flex min-h-24 min-w-0 flex-col justify-between gap-3 rounded-card border bg-surface p-3 text-left sm:p-4 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-border-strong";

export function QuickActions({ store }: { store?: Store }) {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-3 gap-3">
      <GuardedLink kind="products" href="/products/new" className={tile}>
        <span className="grid size-9 place-items-center rounded-control bg-primary text-primary-foreground">
          <Plus className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Add product</span>
      </GuardedLink>
      <button
        type="button"
        className={tile}
        disabled={!store}
        data-coach="share-link"
        onClick={async () => {
          if (store && (await copyText(`https://${SITE_URL}/${store.slug}`, "Store link copied"))) markLinkShared();
        }}
      >
        <span className="grid size-9 place-items-center rounded-control bg-primary-soft text-primary">
          <Link2 className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Copy store link</span>
      </button>
      <Link href="/payouts?withdraw=1" className={tile}>
        <span className="flex items-center justify-between">
          <span className="grid size-9 place-items-center rounded-control bg-accent-soft text-accent-ink">
            <Wallet className="size-4" aria-hidden />
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Withdraw</span>
      </Link>
    </nav>
  );
}
