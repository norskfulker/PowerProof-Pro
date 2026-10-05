"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CurrencyInput } from "@/components/pp/currency-input";
import { money } from "@/lib/money";
import type { Bundle, Coupon, Deal, Product } from "@/lib/types";

export type CouponDraft = Omit<Coupon, "id" | "used"> & { id?: string };
export type BundleDraft = Omit<Bundle, "id"> & { id?: string };
export type DealDraft = Omit<Deal, "id"> & { id?: string };

const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);

function ProductPicker({ products, selected, onChange, max, label }: { products: Product[]; selected: string[]; onChange: (ids: string[]) => void; max?: number; label: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label} ({selected.length}{max ? ` of ${max} max` : ""})</legend>
      <ul className="max-h-60 overflow-y-auto rounded-control border p-1">
        {products.map((p) => {
          const on = selected.includes(p.id);
          return (
            <li key={p.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-[6px] px-2 text-sm hover:bg-muted">
                <Checkbox checked={on} disabled={!on && !!max && selected.length >= max} onCheckedChange={(v) => onChange(v ? [...selected, p.id] : selected.filter((x) => x !== p.id))} />
                <span className="truncate">{p.title}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function CouponEditor({ draft, products, onChange }: { draft: CouponDraft; products: Product[]; onChange: (d: CouponDraft) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-code">Code</Label>
        <Input id="cp-code" className="font-mono uppercase" value={draft.code} onChange={(e) => onChange({ ...draft, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="DIWALI25" />
      </div>
      <RadioGroup value={draft.kind} onValueChange={(v) => onChange({ ...draft, kind: v as Coupon["kind"], value: v === "percent" ? 10 : 10000 })} className="flex gap-6" aria-label="Discount type">
        <label className="flex min-h-11 items-center gap-2 text-sm"><RadioGroupItem value="percent" /> Percent off</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><RadioGroupItem value="fixed" /> Fixed amount</label>
      </RadioGroup>
      {draft.kind === "percent" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-pct">Percent off</Label>
          <Input id="cp-pct" type="number" min={1} max={90} value={draft.value} onChange={(e) => onChange({ ...draft, value: Number(e.target.value) })} />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-fixed">Amount off</Label>
          <CurrencyInput id="cp-fixed" value={money(draft.value)} onChange={(m) => onChange({ ...draft, value: m?.amount ?? 0 })} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-exp">Expires (optional)</Label>
          <Input id="cp-exp" type="datetime-local" value={toLocal(draft.expiresAt)} onChange={(e) => onChange({ ...draft, expiresAt: fromLocal(e.target.value) })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-lim">Usage limit (optional)</Label>
          <Input id="cp-lim" type="number" min={1} value={draft.usageLimit ?? ""} onChange={(e) => onChange({ ...draft, usageLimit: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-min">Minimum spend (optional)</Label>
        <CurrencyInput id="cp-min" value={draft.minSpend} onChange={(m) => onChange({ ...draft, minSpend: m && m.amount > 0 ? m : undefined })} />
      </div>
      <RadioGroup value={draft.scope} onValueChange={(v) => onChange({ ...draft, scope: v as Coupon["scope"] })} className="flex gap-6" aria-label="Works on">
        <label className="flex min-h-11 items-center gap-2 text-sm"><RadioGroupItem value="store" /> Whole store</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><RadioGroupItem value="products" /> Some products</label>
      </RadioGroup>
      {draft.scope === "products" && <ProductPicker products={products} selected={draft.productIds} onChange={(ids) => onChange({ ...draft, productIds: ids })} label="Products" />}
      <label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox checked={draft.active} onCheckedChange={(v) => onChange({ ...draft, active: !!v })} /> Active</label>
    </div>
  );
}

export function BundleEditor({ draft, products, onChange }: { draft: BundleDraft; products: Product[]; onChange: (d: BundleDraft) => void }) {
  const p = draft.pricing;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5"><Label htmlFor="bd-name">Name</Label><Input id="bd-name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Starter bundle" /></div>
      <ProductPicker products={products} selected={draft.productIds} onChange={(ids) => onChange({ ...draft, productIds: ids })} max={5} label="Products (2 to 5)" />
      <RadioGroup value={p.kind} onValueChange={(v) => onChange({ ...draft, pricing: v === "percent" ? { kind: "percent", percent: 30 } : { kind: "price", price: money(99900) } })} className="flex gap-6" aria-label="Bundle pricing">
        <label className="flex min-h-11 items-center gap-2 text-sm"><RadioGroupItem value="percent" /> Percent off</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><RadioGroupItem value="price" /> Set a price</label>
      </RadioGroup>
      {p.kind === "percent" ? (
        <div className="flex flex-col gap-1.5"><Label htmlFor="bd-pct">Percent off the combined price</Label><Input id="bd-pct" type="number" min={1} max={90} value={p.percent} onChange={(e) => onChange({ ...draft, pricing: { kind: "percent", percent: Number(e.target.value) } })} /></div>
      ) : (
        <div className="flex flex-col gap-1.5"><Label htmlFor="bd-price">Bundle price</Label><CurrencyInput id="bd-price" value={p.price} onChange={(m) => m && onChange({ ...draft, pricing: { kind: "price", price: m } })} /></div>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox checked={draft.active} onCheckedChange={(v) => onChange({ ...draft, active: !!v })} /> Active</label>
    </div>
  );
}

export function DealEditor({ draft, products, onChange }: { draft: DealDraft; products: Product[]; onChange: (d: DealDraft) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5"><Label htmlFor="dl-name">Name</Label><Input id="dl-name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Weekend deal" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="dl-pct">Percent off</Label><Input id="dl-pct" type="number" min={1} max={90} value={draft.percentOff} onChange={(e) => onChange({ ...draft, percentOff: Number(e.target.value) })} /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5"><Label htmlFor="dl-start">Starts</Label><Input id="dl-start" type="datetime-local" value={toLocal(draft.startsAt)} onChange={(e) => onChange({ ...draft, startsAt: fromLocal(e.target.value) ?? draft.startsAt })} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="dl-end">Ends</Label><Input id="dl-end" type="datetime-local" value={toLocal(draft.endsAt)} onChange={(e) => onChange({ ...draft, endsAt: fromLocal(e.target.value) ?? draft.endsAt })} /></div>
      </div>
      <ProductPicker products={products} selected={draft.productIds} onChange={(ids) => onChange({ ...draft, productIds: ids })} label="Products (none picked means everything)" />
      <p className="text-sm text-muted-foreground">While it runs, cards show a Deal badge, product pages show a countdown and your store gets a banner.</p>
    </div>
  );
}
