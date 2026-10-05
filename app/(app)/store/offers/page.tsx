"use client";

import { useState } from "react";
import { Layers, Loader2, Plus, Ticket, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { CountdownTimer } from "@/components/pp/countdown-timer";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { couponLabel } from "@/components/pp/offer-card";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { BundleEditor, CouponEditor, DealEditor, type BundleDraft, type CouponDraft, type DealDraft } from "@/components/store-admin/offer-editors";
import { useApi } from "@/hooks/use-api";
import { deleteOffer, getOffers, getProducts, saveBundle, saveCoupon, saveDeal, type Offers } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { bundleTotals, isDealLive } from "@/lib/pricing";

type Editing = { kind: "coupon"; d: CouponDraft } | { kind: "bundle"; d: BundleDraft } | { kind: "deal"; d: DealDraft };

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

export default function OffersPage() {
  const { data, loading, error, reload, setData } = useApi(getOffers, []);
  const products = useApi(() => getProducts({ status: "published" }), []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [toDelete, setToDelete] = useState<{ kind: "coupon" | "bundle" | "deal"; id: string; name: string } | null>(null);
  const ps = products.data ?? [];
  const [now] = useState(() => Date.now());

  async function save() {
    if (!editing) return;
    setPending(true);
    setFormError(undefined);
    try {
      let out: Offers;
      if (editing.kind === "coupon") out = await saveCoupon(editing.d);
      else if (editing.kind === "bundle") out = await saveBundle(editing.d);
      else out = await saveDeal(editing.d);
      setData(out);
      setEditing(null);
      toast.success("Offer saved", { description: "Live on your store straight away." });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setPending(false);
    }
  }

  const start = (e: Editing) => { setEditing(e); setFormError(undefined); };
  const newCoupon = (): Editing => ({ kind: "coupon", d: { code: "", kind: "percent", value: 10, scope: "store", productIds: [], active: true } });
  const newBundle = (): Editing => ({ kind: "bundle", d: { name: "", productIds: [], pricing: { kind: "percent", percent: 30 }, active: true } });
  const newDeal = (): Editing => ({ kind: "deal", d: { name: "", productIds: [], percentOff: 25, startsAt: new Date(now).toISOString(), endsAt: new Date(now + 48 * 3600000).toISOString() } });

  return (
    <>
      <PageHeader title="Offers" description="Coupons, bundles and limited-time deals. A live offer adds a banner to your store home on its own." />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-96 rounded-card" /> : data && (
        <Tabs defaultValue="coupons">
          <TabsList>
            <TabsTrigger value="coupons">Coupons ({data.coupons.length})</TabsTrigger>
            <TabsTrigger value="bundles">Bundles ({data.bundles.length})</TabsTrigger>
            <TabsTrigger value="deals">Deals ({data.deals.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="coupons" className="flex flex-col gap-3 pt-4">
            <Button className="self-start" onClick={() => start(newCoupon())}><Plus aria-hidden /> New coupon</Button>
            {data.coupons.length === 0 ? <EmptyState compact icon={Ticket} title="No coupons yet." body="Make one for your newsletter or a launch." /> : (
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
          <TabsContent value="bundles" className="flex flex-col gap-3 pt-4">
            <Button className="self-start" onClick={() => start(newBundle())}><Plus aria-hidden /> New bundle</Button>
            {data.bundles.length === 0 ? <EmptyState compact icon={Layers} title="No bundles yet." body="Pair products people buy together and price them as one." /> : (
              <ul className="flex flex-col gap-2">
                {data.bundles.map((b) => {
                  const t = bundleTotals(b, ps, data.deals);
                  return (
                    <Row key={b.id} icon={Layers} onEdit={() => start({ kind: "bundle", d: { ...b } })} onDelete={() => setToDelete({ kind: "bundle", id: b.id, name: b.name })}
                      title={b.name}
                      meta={<>{b.productIds.length} products · <MoneyText value={t.price} /> instead of <MoneyText value={t.full} /> ({t.percentOff}% off)</>}
                      status={<StatusPill status={b.active ? "active" : "paused"} label={b.active ? "Active" : "Paused"} tone={b.active ? "success" : "neutral"} />} />
                  );
                })}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="deals" className="flex flex-col gap-3 pt-4">
            <Button className="self-start" onClick={() => start(newDeal())}><Plus aria-hidden /> New deal</Button>
            {data.deals.length === 0 ? <EmptyState compact icon={Timer} title="No deals yet." body="A deal with a countdown is the quickest way to wake up a quiet week." /> : (
              <ul className="flex flex-col gap-2">
                {data.deals.map((d) => {
                  const live = isDealLive(d, now);
                  return (
                    <Row key={d.id} icon={Timer} onEdit={() => start({ kind: "deal", d: { ...d } })} onDelete={() => setToDelete({ kind: "deal", id: d.id, name: d.name })}
                      title={`${d.name}: ${d.percentOff}% off`}
                      meta={<>{d.productIds.length ? `${d.productIds.length} products` : "Everything"} · {formatDate(d.startsAt, { time: true })} to {formatDate(d.endsAt, { time: true })}</>}
                      status={live ? <span className="flex items-center gap-2 text-sm"><StatusPill status="live" /><CountdownTimer endsAt={d.endsAt} compact /></span> : <StatusPill status={Date.parse(d.endsAt) < now ? "ended" : "scheduled"} label={Date.parse(d.endsAt) < now ? "Ended" : "Scheduled"} tone={Date.parse(d.endsAt) < now ? "neutral" : "info"} />} />
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-display text-2xl">{editing?.d.id ? "Edit" : "New"} {editing?.kind}</SheetTitle></SheetHeader>
          <form id="offer" noValidate className="flex flex-col gap-4 px-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
            {formError && <p role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{formError}</p>}
            {editing?.kind === "coupon" && <CouponEditor draft={editing.d} products={ps} onChange={(d) => setEditing({ kind: "coupon", d })} />}
            {editing?.kind === "bundle" && <BundleEditor draft={editing.d} products={ps} onChange={(d) => setEditing({ kind: "bundle", d })} />}
            {editing?.kind === "deal" && <DealEditor draft={editing.d} products={ps} onChange={(d) => setEditing({ kind: "deal", d })} />}
          </form>
          <SheetFooter><Button type="submit" form="offer" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Save</Button></SheetFooter>
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
