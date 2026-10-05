"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/pp/currency-input";
import type { Collection, Product, StoreDesign } from "@/lib/types";

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function HeroEditor({ design, products, collections, onChange }: { design: StoreDesign; products: Product[]; collections: Collection[]; onChange: (d: StoreDesign) => void }) {
  const hero = design.hero;
  const set = (p: Partial<StoreDesign["hero"]>) => onChange({ ...design, hero: { ...hero, ...p } });
  const live = products.filter((p) => p.status === "published");
  return (
    <div className="flex flex-col gap-4">
      <Field id="h-head" label="Headline"><Input id="h-head" value={hero.headline} maxLength={70} onChange={(e) => set({ headline: e.target.value })} /></Field>
      <Field id="h-sub" label="Subtext"><Textarea id="h-sub" rows={2} value={hero.subtext} maxLength={160} onChange={(e) => set({ subtext: e.target.value })} /></Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="h-cta" label="Button label"><Input id="h-cta" value={hero.ctaLabel} maxLength={28} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
        <Field id="h-target" label="Button goes to">
          <Select value={hero.ctaTarget} onValueChange={(v) => set({ ctaTarget: v })}>
            <SelectTrigger id="h-target" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="products">All products</SelectItem>
              {collections.map((c) => <SelectItem key={c.id} value={`collection:${c.slug}`}>Collection: {c.name}</SelectItem>)}
              {live.map((p) => <SelectItem key={p.id} value={`product:${p.slug}`}>Product: {p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Images (pick 1 to 3)</legend>
        <ul className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-control border p-1">
          {live.map((p) => {
            const on = hero.imageProductIds.includes(p.id);
            return (
              <li key={p.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-[6px] px-2 text-sm hover:bg-muted">
                  <Checkbox
                    checked={on}
                    disabled={!on && hero.imageProductIds.length >= 3}
                    onCheckedChange={(v) => set({ imageProductIds: v ? [...hero.imageProductIds, p.id] : hero.imageProductIds.filter((x) => x !== p.id) })}
                  />
                  <span className="truncate">{p.title}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <Field id="h-video" label="Intro video link (optional)" hint="YouTube or Vimeo. Shows a second button.">
        <Input id="h-video" type="url" placeholder="https://youtube.com/watch?v=…" value={hero.videoUrl ?? ""} onChange={(e) => set({ videoUrl: e.target.value || undefined })} />
      </Field>
    </div>
  );
}

export function ContentEditor({ design, products, onChange }: { design: StoreDesign; products: Product[]; onChange: (d: StoreDesign) => void }) {
  const a = design.announcement;
  const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const live = products.filter((p) => p.status === "published");
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="eyebrow mb-1">Announcement bar</legend>
        <Field id="a-text" label="Text"><Input id="a-text" value={a.text} maxLength={80} onChange={(e) => onChange({ ...design, announcement: { ...a, text: e.target.value } })} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="a-code" label="Code (optional)"><Input id="a-code" className="font-mono uppercase" value={a.code ?? ""} onChange={(e) => onChange({ ...design, announcement: { ...a, code: e.target.value.toUpperCase() || undefined } })} /></Field>
          <Field id="a-end" label="Countdown to (optional)">
            <Input id="a-end" type="datetime-local" value={toLocal(a.endsAt)} onChange={(e) => onChange({ ...design, announcement: { ...a, endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined } })} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="eyebrow mb-1">About you</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="ab-name" label="Name"><Input id="ab-name" value={design.about.name} onChange={(e) => onChange({ ...design, about: { ...design.about, name: e.target.value, initials: e.target.value.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() } })} /></Field>
          <Field id="ab-loc" label="Based in"><Input id="ab-loc" value={design.about.location} onChange={(e) => onChange({ ...design, about: { ...design.about, location: e.target.value } })} /></Field>
        </div>
        <Field id="ab-story" label="Your story"><Textarea id="ab-story" rows={4} value={design.about.story} onChange={(e) => onChange({ ...design, about: { ...design.about, story: e.target.value } })} /></Field>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="eyebrow mb-1">Newsletter</legend>
        <Field id="n-h" label="Heading"><Input id="n-h" value={design.newsletter.heading} onChange={(e) => onChange({ ...design, newsletter: { ...design.newsletter, heading: e.target.value } })} /></Field>
        <Field id="n-b" label="Line under it"><Input id="n-b" value={design.newsletter.body} onChange={(e) => onChange({ ...design, newsletter: { ...design.newsletter, body: e.target.value } })} /></Field>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="eyebrow mb-1">Checkout add-on (order bump)</legend>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          Offer an add-on at checkout
          <Switch
            checked={!!design.orderBump}
            onCheckedChange={(v) => onChange({ ...design, orderBump: v && live[0] ? { productId: live[0].id, price: { amount: 9900, currency: "INR" }, label: `Add ${live[0].title}` } : undefined })}
            aria-label="Offer an add-on at checkout"
          />
        </label>
        {design.orderBump && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="ob-p" label="Product">
              <Select value={design.orderBump.productId} onValueChange={(v) => onChange({ ...design, orderBump: { ...design.orderBump!, productId: v, label: `Add ${live.find((p) => p.id === v)?.title ?? ""}` } })}>
                <SelectTrigger id="ob-p" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{live.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field id="ob-price" label="Add-on price">
              <CurrencyInput id="ob-price" value={design.orderBump.price} onChange={(m) => m && onChange({ ...design, orderBump: { ...design.orderBump!, price: m } })} />
            </Field>
          </div>
        )}
      </fieldset>
    </div>
  );
}
