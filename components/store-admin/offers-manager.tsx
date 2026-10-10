"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Layers, Loader2, Pencil, Plus, Sparkles, Ticket, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SaveBar } from "@/components/save/save-bar";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { couponLabel } from "@/components/pp/offer-card";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { BundleBuilder } from "@/components/store-admin/bundle-builder";
import { ProductImageView } from "@/components/pp/product-cover";
import { BundleEditor, CouponEditor, DealEditor, type BundleDraft, type CouponDraft, type DealDraft } from "@/components/store-admin/offer-editors";
import { useApi } from "@/hooks/use-api";
import { deleteOffer, getOffers, getProducts, saveBundle, saveCoupon, saveDeal, type Offers } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { bundleTotals } from "@/lib/pricing";
import type { Bundle, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Editing = { kind: "coupon"; d: CouponDraft } | { kind: "bundle"; d: BundleDraft } | { kind: "deal"; d: DealDraft };

function BundleCard({ b, products, onEdit, onDelete, fresh }: { b: Bundle; products: Product[]; onEdit: () => void; onDelete: () => void; fresh?: boolean }) {
  const t = bundleTotals(b, products, []);
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = b.productIds.map((id) => byId.get(id)).filter((p) => !!p);
  const missing = b.productIds.length - items.length;
  return (
    <li id={`bundle-${b.id}`} className={cn("flex scroll-mt-24 flex-col gap-3 rounded-card border bg-surface p-4 transition-shadow", fresh && "border-primary ring-2 ring-primary/30")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-extrabold [overflow-wrap:anywhere]">{b.name}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{b.productIds.length} products · {b.pricing.kind === "percent" ? `${b.pricing.percent}% off combined` : "Set price"}</p>
        </div>
        <StatusPill status={b.active ? "active" : "paused"} label={b.active ? "Active" : "Paused"} tone={b.active ? "success" : "neutral"} />
      </div>
      {items.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-control border" aria-label="In this bundle">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2 text-sm">
              <ProductImageView image={p.images[0]} fallback={p.tileBackground} fallbackLabel={p.title} size="xs" className="w-12 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <MoneyText value={p.price} className="text-muted-foreground" />
            </li>
          ))}
          {missing > 0 && <li className="p-2 text-sm text-muted-foreground">+{missing} archived or deleted</li>}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Products in this bundle show here.</p>
      )}
      <p className="flex flex-wrap items-baseline gap-2">
        <MoneyText value={t.price} className="font-display text-2xl" />
        <MoneyText value={t.full} className="text-sm text-muted-foreground line-through" />
        {t.percentOff > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-accent-foreground">{t.percentOff}% off</span>}
      </p>
      <div className="mt-auto flex gap-2">
        <Button variant="secondary" size="sm" onClick={onEdit}><Pencil aria-hidden /> Edit</Button>
        <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete}><Trash2 aria-hidden /> Delete</Button>
      </div>
    </li>
  );
}

function Row({ icon: Icon, title, meta, status, onEdit, onDelete }: { icon: React.ComponentType<{ className?: string }>; title: React.ReactNode; meta: React.ReactNode; status: React.ReactNode; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-card border bg-surface p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-soft text-accent-ink"><Icon className="size-5" aria-hidden /></span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="block font-semibold hover:underline">{title}</span>
        <span className="block text-sm text-muted-foreground">{meta}</span>
      </button>
      {status}
      <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete"><Trash2 /></Button>
    </li>
  );
}

export type OfferSection = "coupons" | "bundles" | "deals";
const TITLES: Record<OfferSection, [string, string]> = {
  coupons: ["Coupons", "Codes for your newsletter, a launch or a thank-you. They work at checkout."],
  bundles: ["Bundles", "Products people buy together, priced as one."],
  deals: ["Limited-time deals", "A discount with a countdown. A live deal adds a banner to your store home on its own."],
};

/**
 * Coupons, bundles and limited-time deals (Part 7C). The same screen serves Store › Offers (with
 * tabs that are routes) and Catalog › Bundles (bundles only).
 */
export function OffersManager({ section, storeId, tabs = true }: { section: OfferSection; storeId: string; tabs?: boolean }) {
  const router = useRouter();
  const { data, loading, error, reload, setData } = useApi(getOffers, []);
  const products = useApi(() => getProducts().then((l) => l.filter((p) => p.status !== "archived")), []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [original, setOriginal] = useState<Editing | null>(null);
  const unsaved = useUnsavedGuard();
  const [toDelete, setToDelete] = useState<{ kind: "coupon" | "bundle" | "deal"; id: string; name: string } | null>(null);
  const ps = products.data ?? [];
  const [now] = useState(() => Date.now());
  // Bundles: the products picked on the page, and the bundle made last (highlighted in the list)
  const [picked, setPicked] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string>();
  const knownBundles = useRef<string[]>([]);

  const bar = useDirtyForm({
    value: editing,
    saved: original,
    onSave: async (e) => {
      if (!e) return;
      let out: Offers;
      if (e.kind === "coupon") out = await saveCoupon(e.d);
      else if (e.kind === "bundle") {
        knownBundles.current = (data?.bundles ?? []).map((b) => b.id);
        out = await saveBundle(e.d);
        if (!e.d.id) {
          setPicked([]);
          setFresh(out.bundles.find((b) => !knownBundles.current.includes(b.id))?.id);
        }
      } else out = await saveDeal(e.d);
      setData(out);
      setEditing(null);
      setOriginal(null);
    },
    onDiscard: () => setEditing(original),
    savedMessage: "Offer saved. It's live on your store straight away.",
    autosave: false,
  });
  const isNew = !editing?.d.id;

  const start = (e: Editing) => { setEditing(e); setOriginal(e); };
  const newCoupon = (): Editing => ({ kind: "coupon", d: { code: "", kind: "percent", value: 10, scope: "store", productIds: [], active: true } });
  const newBundle = (productIds: string[] = []): Editing => ({ kind: "bundle", d: { name: "", productIds, pricing: { kind: "percent", percent: 30 }, active: true } });
  const pickingNew = editing?.kind === "bundle" && !editing.d.id;
  // Picking a second product opens the bundle's settings; the sheet and the grid stay in step
  const togglePick = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    if (pickingNew) setEditing({ kind: "bundle", d: { ...editing.d, productIds: next } });
    else if (!editing && next.length >= 2 && !picked.includes(id)) start(newBundle(next));
  };

  // The bundle just made: scroll it into view, then let the highlight fade
  useEffect(() => {
    if (!fresh) return;
    document.getElementById(`bundle-${fresh}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setFresh(undefined), 4000);
    return () => clearTimeout(t);
  }, [fresh]);

  return (
    <>
      <PageHeader
        title={TITLES[section][0]}
        description={TITLES[section][1]}
        actions={
          <>
            {section === "coupons" && <Button onClick={() => start(newCoupon())}><Plus aria-hidden /> New coupon</Button>}
            <Button asChild variant="secondary">
              <Link href={`/store/${storeId}/offers/deal-paths`}>
                <Sparkles aria-hidden /> Deal paths at checkout
              </Link>
            </Button>
          </>
        }
      />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-96 rounded-card" /> : data && (
        <Tabs value={section} onValueChange={(v) => router.replace(`/store/${storeId}/offers/${v}`, { scroll: false })}>
          <TabsList className={tabs ? undefined : "hidden"}>
            <TabsTrigger value="coupons">Coupons ({data.coupons.length})</TabsTrigger>
            <TabsTrigger value="bundles">Bundles ({data.bundles.length})</TabsTrigger>
            <TabsTrigger value="deals">Limited-time deals ({data.deals.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="coupons" className="flex flex-col gap-3 pt-4">
            {data.coupons.length === 0 ? <EmptyState compact icon={Ticket} title="No coupons yet." body="Make one for your newsletter or a launch." action={<Button onClick={() => start(newCoupon())}><Plus aria-hidden /> New coupon</Button>} /> : (
              <ul className="flex flex-col gap-2">
                {data.coupons.map((c) => {
                  const expired = !!c.expiresAt && Date.parse(c.expiresAt) < now;
                  const usedUp = c.usageLimit !== undefined && c.used >= c.usageLimit;
                  return (
                    <Row key={c.id} icon={Ticket} onEdit={() => start({ kind: "coupon", d: { ...c } })} onDelete={() => setToDelete({ kind: "coupon", id: c.id, name: c.code })}
                      title={<span className="font-mono">{c.code}</span>}
                      meta={<>{couponLabel(c)} · {c.scope === "store" ? "whole store" : `${c.productIds.length} products`} · used {c.used}{c.usageLimit ? ` of ${c.usageLimit}` : ""}{c.expiresAt ? ` · ends ${formatDate(c.expiresAt)}` : ""}</>}
                      status={<StatusPill status={!c.active ? "paused" : expired ? "expired" : usedUp ? "used_up" : "active"} label={!c.active ? "Paused" : expired ? "Expired" : usedUp ? "Used up" : "Active"} tone={!c.active || expired || usedUp ? "neutral" : "success"} />} />
                  );
                })}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="bundles" className="flex flex-col gap-8 pt-4">
            {products.loading && !products.data ? <Skeleton className="h-64 rounded-card" /> : (
              <BundleBuilder products={ps} picked={picked} onToggle={togglePick} onOpen={() => start(newBundle(picked))} onClear={() => setPicked([])} open={pickingNew} />
            )}
            <section aria-labelledby="bundles-made" className="flex flex-col gap-3">
              <h2 id="bundles-made" className="font-display text-xl">Your bundles ({data.bundles.length})</h2>
              {data.bundles.length === 0 ? (
                <EmptyState compact icon={Layers} title="No bundles yet." body="Pick two or more products above. Your bundles, with their products and prices, show here." />
              ) : (
                <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {data.bundles.map((b) => (
                    <BundleCard key={b.id} b={b} products={ps} fresh={b.id === fresh} onEdit={() => start({ kind: "bundle", d: { ...b } })} onDelete={() => setToDelete({ kind: "bundle", id: b.id, name: b.name })} />
                  ))}
                </ul>
              )}
            </section>
          </TabsContent>
          <TabsContent value="deals" className="flex flex-col gap-3 pt-4">
            <EmptyState compact icon={Timer} title="Limited-time deals are coming soon." body="For now, make a deal path with an end date: it shows a countdown at checkout." />
          </TabsContent>
        </Tabs>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && (bar.dirty ? unsaved.confirmLeave(() => setEditing(null)) : setEditing(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-display text-2xl">{editing?.d.id ? "Edit" : "New"} {editing?.kind}</SheetTitle></SheetHeader>
          <form id="offer" noValidate className="flex flex-col gap-4 px-4" onSubmit={(e) => { e.preventDefault(); bar.save(); }}>
            {isNew && bar.error && <p role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{bar.error}</p>}
            {editing?.kind === "coupon" && <CouponEditor draft={editing.d} products={ps} onChange={(d) => setEditing({ kind: "coupon", d })} />}
            {editing?.kind === "bundle" && <BundleEditor draft={editing.d} products={ps} onChange={(d) => { setEditing({ kind: "bundle", d }); if (!d.id) setPicked(d.productIds); }} />}
            {editing?.kind === "deal" && <DealEditor draft={editing.d} products={ps} onChange={(d) => setEditing({ kind: "deal", d })} />}
          </form>
          <SheetFooter>
            {isNew ? (
              <>
                <Button type="submit" form="offer" disabled={bar.saving}>{bar.saving && <Loader2 className="animate-spin" aria-hidden />} Add {editing?.kind}</Button>
              </>
            ) : (
              <SaveBar state={bar} bottomOffset="none" className="max-md:static max-md:border-0 max-md:p-0 max-md:shadow-none md:border-0 md:p-0" />
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="It stops working straight away. Orders that already used it aren't affected."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!toDelete) return;
          setData(await deleteOffer(toDelete.kind, toDelete.id));
          toast.success("Deleted");
        }}
      />
    </>
  );
}
