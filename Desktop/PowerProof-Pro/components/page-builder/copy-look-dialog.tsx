"use client";

import { useState } from "react";
import { Check, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RenderContext } from "@/lib/api";
import { themeWithLook, type CopiedLook } from "@/lib/import/look";
import { presetById } from "@/lib/pages/templates";
import { FONT_PAIRS } from "@/lib/store-themes";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";

const CORNERS = { sharp: "Sharp", soft: "Soft", round: "Round" } as const;

/**
 * "Copy a store": paste another store's address (Shopify or any site), see its colours, fonts,
 * corners and sections, and start from them. Only the look comes across, as an undoable draft;
 * the sections are our own ready-made ones, filled with this store's products.
 */
export function CopyLookDialog({ context }: { context: RenderContext }) {
  const open = useEditor((s) => !!s.copyLook);
  const setOpen = useEditor((s) => s.setCopyLook);
  const restyle = useEditor((s) => s.restyle);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [look, setLook] = useState<CopiedLook>();
  const [useLook, setUseLook] = useState(true);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  async function read(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return setError("Paste the store's address.");
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/import/look", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId: context.store.id, url }) });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; look?: CopiedLook };
      if (!json.ok || !json.look) throw new Error(json.message ?? "We couldn't read that site.");
      setLook(json.look);
      setPicked(new Set(json.look.sections.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't read that site.");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!look) return;
    const ctx = { slug: context.store.slug, products: context.products.map((p) => ({ id: p.id, title: p.title })), collections: context.collections.map((c) => ({ slug: c.slug, name: c.name })) };
    const blocks = look.sections.filter((_, i) => picked.has(i)).map((s) => presetById(s.preset)?.build(ctx)).filter((b): b is NonNullable<typeof b> => !!b);
    restyle(
      (site) => (useLook ? { ...site, design: { ...site.design, theme: themeWithLook(site.design.theme, look) } } : site),
      (doc) => (blocks.length ? { ...doc, blocks } : doc)
    );
    toast.success("Copied", { description: "It's a draft: undo, or change anything, before you publish." });
    close();
  }

  function close() {
    setOpen(false);
    setLook(undefined);
    setError(undefined);
  }

  const pair = look ? FONT_PAIRS.find((f) => f.id === look.fontPair) : undefined;
  const toggle = (i: number) => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="size-5 text-primary" aria-hidden /> Copy a store&apos;s look</DialogTitle>
          <DialogDescription>Paste the address of a store you like (Shopify or any site). We take its colours, fonts, corners and the kinds of sections on its home page. Not its words, pictures or code.</DialogDescription>
        </DialogHeader>
        <form onSubmit={read} className="flex flex-col gap-1.5">
          <Label htmlFor="copy-url">Store address</Label>
          <div className="flex gap-2">
            <Input id="copy-url" type="url" inputMode="url" placeholder="https://brand.myshopify.com" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus aria-invalid={!!error || undefined} />
            <Button type="submit" variant="secondary" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}{look ? "Read again" : "Read it"}</Button>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </form>

        {look && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              {look.platform}{look.themeName ? ` · ${look.themeName} theme` : ""} · {look.title}
            </p>
            <div className="flex flex-col gap-3 rounded-control border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Colours, fonts and corners</span>
                <Switch checked={useLook} onCheckedChange={setUseLook} aria-label="Use its colours, fonts and corners" />
              </div>
              <div className={cn("flex flex-col gap-3", !useLook && "opacity-50")}>
                <div className="flex overflow-hidden rounded-control border" aria-label="Its colours">
                  {[["Page", look.colors.background], ["Text", look.colors.text], ["Brand", look.colors.primary], ...(look.colors.accent ? [["Accent", look.colors.accent]] : [])].map(([name, c]) => (
                    <div key={name} className="flex h-14 flex-1 flex-col justify-end p-1.5 text-[0.625rem] font-medium" style={{ background: c, color: name === "Page" ? look.colors.text : look.colors.background }}>
                      {name}
                      <span className="font-mono opacity-80">{c}</span>
                    </div>
                  ))}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Fonts</dt>
                  <dd>{[look.fonts.heading, look.fonts.body].filter(Boolean).join(" + ") || "Not named"} → <span className="font-medium">{pair?.pair}</span></dd>
                  <dt className="text-muted-foreground">Corners</dt>
                  <dd>{look.corners ? CORNERS[look.corners] : "Kept as they are"}</dd>
                  <dt className="text-muted-foreground">Mode</dt>
                  <dd>{look.dark ? "Dark" : "Light"}</dd>
                </dl>
              </div>
            </div>
            <fieldset className="flex flex-col gap-2 rounded-control border p-3">
              <legend className="px-1 text-sm font-semibold">Sections ({picked.size} of {look.sections.length})</legend>
              {look.sections.length === 0 ? (
                <p className="text-xs text-muted-foreground">We couldn&apos;t tell its sections apart, so your page stays as it is.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">These replace this page&apos;s sections, in the same order, filled with your products.</p>
                  <ol className="flex flex-col gap-1">
                    {look.sections.map((s, i) => (
                      <li key={i}>
                        <button type="button" role="checkbox" aria-checked={picked.has(i)} onClick={() => toggle(i)} className="flex min-h-9 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-muted">
                          <span className={cn("grid size-4 place-items-center rounded-[4px] border", picked.has(i) && "border-primary bg-primary text-primary-foreground")} aria-hidden>{picked.has(i) && <Check className="size-3" />}</span>
                          <span className="font-medium">{presetById(s.preset)?.name ?? s.preset}</span>
                          <span className="truncate text-xs text-muted-foreground">from “{s.source}”</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </fieldset>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="button" onClick={apply} disabled={!look || (!useLook && picked.size === 0)}>Copy to my store</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
