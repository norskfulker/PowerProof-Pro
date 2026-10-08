"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Circle, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/pp/status-pill";
import { kindLabel } from "@/components/pp/product-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { publishProduct, setProductCollections, updateProduct } from "@/lib/api";
import type { Collection, Product, ProductKind } from "@/lib/types";
import { DRAFT_NOTE, publishBlockers, readiness } from "./readiness";

const KINDS: ProductKind[] = ["ebook", "template", "preset", "notion", "course", "audio", "other"];
const NONE = "__none";

export interface Imported {
  product: Product;
  /** The collection it was put in, if any */
  collectionId?: string;
}

/**
 * After a bulk import: every product arrives as a draft, so this is the checklist of what each one
 * still needs. Classify it here (type, collection); images, video and files are added on the product.
 */
export function FinishDrafts({ items, collections, onChange }: { items: Imported[]; collections: Collection[]; onChange: (next: Imported[]) => void }) {
  const [busy, setBusy] = useState<string>();
  const replace = (id: string, patch: Partial<Imported> & { product?: Product }) => onChange(items.map((i) => (i.product.id === id ? { ...i, ...patch } : i)));
  const ready = items.filter((i) => readiness(i.product, !!i.collectionId).every((r) => r.done)).length;
  const canGoLive = (i: Imported) => i.product.status !== "published" && publishBlockers(i.product, !!i.collectionId).length === 0;
  const live = items.filter((i) => i.product.status === "published").length;

  /** Goes live one by one so a failure on one doesn't stop the rest */
  async function goLive(list: Imported[]) {
    setBusy("all");
    let made = 0;
    for (const i of list) {
      try {
        replace(i.product.id, { product: await publishProduct(i.product.id) });
        made++;
      } catch (e) {
        toast.error(`${i.product.title} can't go live`, { description: e instanceof Error ? e.message : undefined });
      }
    }
    setBusy(undefined);
    if (made) toast.success(`${made} product${made === 1 ? " is" : "s are"} live`);
  }

  async function setKind(i: Imported, kind: ProductKind) {
    setBusy(i.product.id);
    try {
      replace(i.product.id, { product: await updateProduct(i.product.id, { kind }) });
    } catch (e) {
      toast.error("Couldn't save the type", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(undefined);
    }
  }
  async function setCollection(i: Imported, id: string) {
    setBusy(i.product.id);
    try {
      await setProductCollections(i.product.id, id === NONE ? [] : [id]);
      replace(i.product.id, { collectionId: id === NONE ? undefined : id });
    } catch (e) {
      toast.error("Couldn't save the collection", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section aria-labelledby="finish-h" className="mt-6 rounded-card border bg-surface p-5 md:p-6">
      <h2 id="finish-h" className="font-sans text-base font-semibold tracking-normal">Finish your {items.length} draft{items.length === 1 ? "" : "s"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{DRAFT_NOTE} Classify each one below, then open it to add images, video and its file. {ready} of {items.length} ready to publish{live > 0 ? `, ${live} live` : ""}.</p>
      <Button type="button" className="mt-3" disabled={busy !== undefined || !items.some(canGoLive)} onClick={() => void goLive(items.filter(canGoLive))}>
        {busy === "all" ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Make every ready product live
      </Button>
      {!items.some(canGoLive) && live < items.length && <p className="mt-2 text-sm text-muted-foreground">A digital product goes live once it has its file; a physical one once it is in a collection.</p>}
      <ul className="mt-4 flex flex-col divide-y rounded-control border">
        {items.map((i) => {
          const list = readiness(i.product, !!i.collectionId);
          const digital = i.product.fulfilment === "digital";
          return (
            <li key={i.product.id} className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto] lg:items-center">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium"><span className="truncate">{i.product.title}</span> <StatusPill status={i.product.status} /></p>
                <p className="text-xs text-muted-foreground">{digital ? "Digital" : "Physical"} · {i.product.status === "published" ? "live on your store" : "not visible to buyers"}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {digital && (
                  <Select value={i.product.kind} onValueChange={(v) => void setKind(i, v as ProductKind)} disabled={busy === i.product.id}>
                    <SelectTrigger className="w-full sm:w-40" aria-label={`Type of ${i.product.title}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{kindLabel(k)}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Select value={i.collectionId ?? NONE} onValueChange={(v) => void setCollection(i, v)} disabled={busy === i.product.id}>
                  <SelectTrigger className="w-full sm:w-48" aria-label={`Collection of ${i.product.title}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No collection</SelectItem>
                    {collections.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label={`Checklist for ${i.product.title}`}>
                  {list.map((r) => (
                    <li key={r.key} className={r.done ? "flex items-center gap-1 text-success" : "flex items-center gap-1 text-muted-foreground"}>
                      {r.done ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
                      {r.label}
                      <span className="sr-only">{r.done ? " done" : " still needed"}</span>
                    </li>
                  ))}
                </ul>
                {i.product.status !== "published" && (
                  <Button type="button" size="sm" variant={canGoLive(i) ? "primary" : "secondary"} disabled={busy !== undefined || !canGoLive(i)} title={canGoLive(i) ? undefined : publishBlockers(i.product, !!i.collectionId)[0]} onClick={() => void goLive([i])}>
                    <Rocket aria-hidden /> Make it live
                  </Button>
                )}
                <Link href={`/catalog/products/${i.product.id}`} className="inline-flex min-h-9 items-center font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11">
                  Add images, video{digital ? " and file" : ""}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
