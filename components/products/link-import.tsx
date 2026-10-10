"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Package, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { usePlan } from "@/components/plan/plan-context";
import { MoneyText } from "@/components/pp/money-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentStore } from "@/hooks/use-current-store";
import { copyImages, createProduct, previewImport, type ImportedProduct, type PreviewReply } from "@/lib/api";
import { money } from "@/lib/money";
import type { CurrencyCode, ProductInput } from "@/lib/types";
import { uid } from "@/lib/uid";

/** A product read from a link, as a draft here. Prices are already in the store's currency. */
function toDraft(p: ImportedProduct, currency: CurrencyCode, images: string[], video?: string): ProductInput {
  const m = (n: number) => money(n, currency);
  return {
    title: p.title,
    description: p.description,
    kind: "other",
    fulfilment: p.fulfilment,
    price: m(p.price),
    compareAt: p.compareAt && p.compareAt > p.price ? m(p.compareAt) : undefined,
    images: images.map((src, i) => ({ id: uid("img"), alt: p.images[i]?.alt || p.title, src })),
    video: video ? { src: video, alt: p.title, kind: "video" } : undefined,
    files: [],
    sku: "",
    // Goods use the creator's own HSN code (added later); downloads the usual software code
    taxCode: p.fulfilment === "digital" ? "998433" : "",
    taxRate: p.fulfilment === "digital" ? 18 : undefined,
    status: "draft",
    sourceUrl: p.sourceUrl,
  };
}

/**
 * Add products from a link: a product page or a shop's address (Amazon, Flipkart, Shopify,
 * WooCommerce, any shop). Title, description and price, checked by AI; pictures and a video when
 * the creator may use them. Everything arrives as a draft.
 */
export function LinkImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const router = useRouter();
  const store = useCurrentStore();
  const plan = usePlan();
  const [url, setUrl] = useState("");
  const [rights, setRights] = useState(false);
  const [media, setMedia] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [reply, setReply] = useState<PreviewReply>();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const products = useMemo(() => reply?.preview.products ?? [], [reply]);
  const chosen = products.filter((p) => picked.has(p.key));
  const s = store.data;

  function reset() {
    setReply(undefined);
    setPicked(new Set());
    setError(undefined);
    setBusy(undefined);
  }

  async function read() {
    if (!s) return;
    setBusy("Reading the page and checking it with AI…");
    setError(undefined);
    try {
      const r = await previewImport({ storeId: s.id, source: "link", url, rights, media });
      setReply(r);
      setPicked(new Set(r.preview.products.filter((p) => !r.existing.includes(p.key)).map((p) => p.key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That link couldn't be read.");
    } finally {
      setBusy(undefined);
    }
  }

  async function add() {
    if (!s) return;
    const made: { id: string; title: string }[] = [];
    const failed: string[] = [];
    for (const [i, p] of chosen.entries()) {
      setBusy(`Adding ${i + 1} of ${chosen.length}: ${p.title}`);
      try {
        const files = [...p.images.map((x) => x.src), ...(p.video ? [p.video.src] : [])];
        const copied = files.length ? await copyImages(s.id, files) : {};
        const images = p.images.map((x) => copied[x.src]).filter((x): x is string => !!x);
        let input = toDraft(p, s.currency, images, p.video ? (copied[p.video.src] ?? undefined) : undefined);
        let product;
        try {
          product = await createProduct(input);
        } catch (e) {
          // A title that clashes with one already here
          if (e instanceof Error && /already exists/i.test(e.message)) {
            input = { ...input, title: `${input.title} (imported)` };
            product = await createProduct(input);
          } else throw e;
        }
        made.push({ id: product.id, title: product.title });
      } catch (e) {
        if (plan.handleLimitError(e)) break;
        failed.push(`${p.title}: ${e instanceof Error ? e.message : "couldn't be added"}`);
      }
    }
    setBusy(undefined);
    if (failed.length) toast.error(`${failed.length} couldn't be added`, { description: failed.slice(0, 3).join(" · ") });
    if (!made.length) return;
    onDone?.();
    onOpenChange(false);
    reset();
    setUrl("");
    // One product: straight to it, to add pictures, a file or a collection. Several: the drafts.
    if (made.length === 1) {
      toast.success("Added as a draft", { description: "Check it over and add what's missing, then make it live." });
      router.push(`/catalog/products/${made[0].id}`);
    } else {
      toast.success(`${made.length} products added as drafts`, { description: "Open each one to finish it, then make it live." });
      router.push("/catalog/products?status=draft");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl"><Link2 className="size-5 text-primary" aria-hidden /> Add from a link</DialogTitle>
          <DialogDescription>A product page or a shop&apos;s address: Amazon, Flipkart, Shopify, WooCommerce or any shop site. We bring the title, description and price, and AI checks them.</DialogDescription>
        </DialogHeader>

        {!reply ? (
          <form id="link-import" className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void read(); }}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="li-url">Link</Label>
              <Input id="li-url" inputMode="url" autoComplete="url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://shop.com/products/linen-tote" disabled={!!busy} />
            </div>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <Checkbox className="mt-0.5" checked={rights} onCheckedChange={(v) => setRights(v === true)} disabled={!!busy} />
              <span>I own these products or have the seller&apos;s permission to sell them. <span className="text-muted-foreground">We keep a note of the link.</span></span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <Checkbox className="mt-0.5" checked={media} onCheckedChange={(v) => setMedia(v === true)} disabled={!!busy} />
              <span>Bring the pictures and video too <span className="block text-muted-foreground">Only if you&apos;re allowed to use them: product photos usually belong to the brand or seller. Videos come across when the page has a plain video file under 10 MB.</span></span>
            </label>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{reply.preview.label} · {products.length} product{products.length === 1 ? "" : "s"}</p>
            {!!reply.preview.warnings.length && <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-warning-ink">{reply.preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            {products.length > 1 && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox checked={chosen.length === products.length} onCheckedChange={(v) => setPicked(v === true ? new Set(products.map((p) => p.key)) : new Set())} /> {chosen.length} of {products.length} selected
              </label>
            )}
            <ul className="flex max-h-[46dvh] flex-col divide-y overflow-y-auto rounded-card border">
              {products.map((p) => (
                <li key={p.key}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-muted/40">
                    <Checkbox className="mt-1" checked={picked.has(p.key)} onCheckedChange={(v) => setPicked((old) => { const n = new Set(old); if (v === true) n.add(p.key); else n.delete(p.key); return n; })} aria-label={`Add ${p.title}`} />
                    {/* The source's picture before it's copied: plain img, no optimiser domains */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.images[0] ? <img src={p.images[0].src} alt="" className="size-14 shrink-0 rounded-control border object-cover" loading="lazy" /> : <span className="grid size-14 shrink-0 place-items-center rounded-control bg-muted"><Package className="size-5 text-muted-foreground" aria-hidden /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{p.title}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-sm">
                        <MoneyText value={money(p.price, p.currency as CurrencyCode)} />
                        {p.compareAt && p.compareAt > p.price && <MoneyText value={money(p.compareAt, p.currency as CurrencyCode)} className="text-muted-foreground line-through" />}
                        <span className="text-xs text-muted-foreground">{p.fulfilment === "physical" ? "Physical" : "Digital"}{p.images.length ? ` · ${p.images.length} picture${p.images.length === 1 ? "" : "s"}` : ""}{p.video ? " · video" : ""}</span>
                        {reply.existing.includes(p.key) && <span className="text-xs text-muted-foreground">· added before</span>}
                      </span>
                      {p.description && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{p.description}</span>}
                      {!!p.problems.length && <span className="mt-1 block text-xs text-warning-ink">{p.problems.join(" ")}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" aria-hidden /> {busy}</p>}
        {error && <p role="alert" className="rounded-control border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}

        <DialogFooter>
          {!reply ? (
            <Button type="submit" form="link-import" disabled={!!busy || !rights || url.trim().length < 4}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} Get products</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={reset} disabled={!!busy}>Back</Button>
              <Button onClick={add} disabled={!!busy || !chosen.length}>{busy && <Loader2 className="animate-spin" aria-hidden />} Add {chosen.length} as draft{chosen.length === 1 ? "" : "s"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
