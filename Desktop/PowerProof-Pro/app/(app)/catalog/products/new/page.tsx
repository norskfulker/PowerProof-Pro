"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Link2 } from "lucide-react";
import { GuardedLink, LimitNotice } from "@/components/plan/plan-context";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SELL_KINDS, useSellToggle } from "@/components/store-admin/shipping-settings";
import { LinkImportDialog } from "@/components/products/link-import";
import { NewProductForm } from "@/components/products/new-product-form";
import { SwitchLiveKindButton } from "@/components/products/switch-live-kind";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getProducts } from "@/lib/api";
import { sellsKind, soldKinds } from "@/lib/shipping";
import { cn } from "@/lib/utils";

/** One way per kind. Both cards always show; each kind is switched on or off for the store right here. */
const WAYS = [
  {
    href: "/catalog/products/new/upload?type=digital",
    title: "Digital product",
    body: "Something buyers download: a PDF, template, preset, course or audio. Upload the file, name it, set a price.",
    meta: "About a minute",
    kind: "digital",
  },
  {
    href: "/catalog/products/new/upload?type=physical",
    title: "Physical product",
    body: "Something you ship. Same steps, without a file, and it lives in a collection so buyers can find it.",
    meta: "Needs a collection",
    kind: "physical",
  },
] as const;

export default function NewProductPage() {
  const products = useApi(() => getProducts(), []);
  const store = useCurrentStore();
  const sell = useSellToggle(store.data);
  const [fromLink, setFromLink] = useState(false);
  // Someone's first product is three short steps; after that, the full form and a way to import many
  if ((!products.data && !products.error) || !store.data) return <Skeleton className="h-96 rounded-card" />;
  if (products.data?.length === 0) return <NewProductForm wizard />;
  const sells = store.data.sells;
  const active = (products.data ?? []).filter((p) => p.status !== "archived");
  return (
    <>
      <PageHeader back={{ href: "/catalog/products", label: "Your products" }} title="Add a product" />
      <LimitNotice kind="products" />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {WAYS.map((w) => {
          const k = SELL_KINDS.find((x) => x.kind === w.kind)!;
          const on = sellsKind(sells, w.kind);
          const last = on && soldKinds(sells).length === 1;
          const inUse = active.filter((p) => p.fulfilment === w.kind).length;
          // Only one kind can be live at a time (the database checks)
          const liveHere = active.some((p) => p.fulfilment === w.kind && p.status === "published");
          const liveOther = active.some((p) => p.fulfilment !== w.kind && p.status === "published");
          const inner = (
            <>
              <h2 className="mt-5 flex flex-wrap items-center gap-2 text-xl">
                {w.title}
                {liveHere && <span className="rounded-full bg-success-soft px-2.5 py-0.5 font-sans text-xs font-semibold text-success">Live now</span>}
              </h2>
              {on && liveOther && <p className="mt-1 text-sm text-muted-foreground">Your {w.kind === "digital" ? "physical" : "digital"} products are live. New ones here start as drafts.</p>}
              <p className="mt-2 flex-1 text-muted-foreground">{on ? w.body : `Switched off, so buyers can't buy ${w.kind} products. Turn it on to add one.`}</p>
              <span className="mt-5 flex items-center justify-between border-t pt-4">
                <span className="eyebrow">{on ? w.meta : "Off"}</span>
                {on && <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-1" aria-hidden />}
              </span>
            </>
          );
          return (
            <li key={w.href} data-coach={on ? "new-product" : undefined} className={cn("relative flex flex-col rounded-card border bg-surface p-6 transition-[border-color,transform] duration-150", on ? "has-[a:hover]:-translate-y-0.5 has-[a:hover]:border-primary" : "bg-surface-sunken")}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn("grid size-12 place-items-center rounded-control", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <k.icon className="size-5" aria-hidden />
                </span>
                {on && liveOther && <SwitchLiveKindButton to={w.kind} className="ml-auto" />}
                <label className="relative z-10 flex min-h-11 items-center gap-2 text-sm font-medium" title={last ? "Keep at least one kind on" : on && inUse ? `Archive your ${inUse} ${w.kind} product${inUse === 1 ? "" : "s"} first to switch this off` : undefined}>
                  {on ? "On" : "Off"}
                  <Switch checked={on} disabled={last || !!sell.busy} onCheckedChange={(v) => sell.toggle(w.kind, v)} aria-label={`Sell ${w.kind} products`} />
                </label>
              </div>
              {on ? (
                <GuardedLink kind="products" href={w.href} className="group flex flex-1 flex-col after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary">
                  {inner}
                </GuardedLink>
              ) : (
                <div className="flex flex-1 flex-col opacity-70">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        You can add both kinds, but only one kind is live at a time. Switch between them in one click: the live kind goes to drafts and the other goes live. Switch a kind off to hide it here; archive its products first.{" "}
        <Link href={`/store/${store.data.id}/settings`} className="font-medium text-primary underline underline-offset-4">Shipping and cash on delivery</Link> live in Store settings.
      </p>
      <section aria-labelledby="link-h" className="mt-6 flex flex-wrap items-center gap-4 rounded-card border bg-surface p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-control bg-primary-soft text-primary"><Link2 className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <h2 id="link-h" className="font-sans text-base font-semibold tracking-normal">Add from a link</h2>
          <p className="text-sm text-muted-foreground">Paste a product page or a shop&apos;s address (Amazon, Flipkart, Shopify, any shop). The title, description and price fill in, checked by AI.</p>
        </span>
        <Button variant="secondary" onClick={() => setFromLink(true)}>Paste a link</Button>
      </section>
      <LinkImportDialog open={fromLink} onOpenChange={setFromLink} />
      <section aria-labelledby="bulk-h" className="mt-4 flex flex-wrap items-center gap-4 rounded-card border border-dashed bg-surface-sunken p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-control bg-muted text-muted-foreground"><FileSpreadsheet className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <h2 id="bulk-h" className="font-sans text-base font-semibold tracking-normal">Import many products at once</h2>
          <p className="text-sm text-muted-foreground">Fill in a spreadsheet (CSV) and bring a whole catalogue in. We give you the format to follow.</p>
        </span>
        <Button asChild variant="secondary">
          <Link href="/catalog/products/import">Import from CSV</Link>
        </Button>
      </section>
    </>
  );
}
