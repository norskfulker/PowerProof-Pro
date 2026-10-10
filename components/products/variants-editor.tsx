"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { CurrencyInput } from "@/components/pp/currency-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { uid } from "@/lib/uid";
import type { CurrencyCode, Money } from "@/lib/types";
import type { ProductValues } from "./product-schema";

type Option = NonNullable<ProductValues["options"]>[number];
type Variant = NonNullable<ProductValues["variants"]>[number];

const MAX_VARIANTS = 100;
const SUGGESTIONS = ["Size", "Colour", "Material", "Style"];

/** Every combination of the options' choices, in order: [["S","Red"],["S","Blue"],…] */
export function combinations(options: Option[]): string[][] {
  return options.reduce<string[][]>((acc, o) => acc.flatMap((c) => o.values.map((v) => [...c, v])), [[]]).filter((c) => c.length === options.length && c.length > 0);
}

/**
 * The variants for a set of options: one per combination. A combination that already had a variant
 * keeps it (price, SKU, stock), so editing a choice never loses what was typed.
 */
export function syncVariants(options: Option[], current: Variant[], price: Money): Variant[] {
  const byKey = new Map(current.map((v) => [v.options.join("\u0000"), v]));
  return combinations(options)
    .slice(0, MAX_VARIANTS)
    .map((combo) => byKey.get(combo.join("\u0000")) ?? { id: uid("var"), title: combo.join(" / "), options: combo, sku: "", price: { ...price }, stock: 0 })
    .map((v) => ({ ...v, title: v.options.join(" / ") }));
}

/** Type a choice and press Enter (or a comma) to add it */
function ValuesInput({ id, values, onChange }: { id: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const next = raw.split(",").map((s) => s.trim()).filter(Boolean).filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (next.length) onChange([...values, ...next].slice(0, 50));
    setDraft("");
  };
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border bg-surface px-2 py-1.5 focus-within:outline-2 focus-within:outline-primary">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-sm">
          {v}
          <button type="button" className="grid size-6 place-items-center rounded-full hover:bg-background" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder={values.length ? "Add another" : "S, M, L"}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
      />
    </div>
  );
}

/**
 * A physical product's choices (Size, Colour…), the variant for each combination with its own
 * price, SKU and stock, and whether stock is counted at all.
 */
export function VariantsEditor({
  value,
  onChange,
  currency,
  price,
  errors,
}: {
  value: Pick<ProductValues, "options" | "variants" | "trackStock" | "stock">;
  onChange: (patch: Partial<Pick<ProductValues, "options" | "variants" | "trackStock" | "stock">>) => void;
  currency: CurrencyCode;
  price: Money;
  errors?: { options?: string; stock?: string; variants?: string };
}) {
  const options = value.options ?? [];
  const variants = value.variants ?? [];
  const track = !!value.trackStock;
  const setOptions = (next: Option[]) => onChange({ options: next, variants: syncVariants(next.filter((o) => o.name.trim() && o.values.length), variants, price) });
  const setVariant = (i: number, patch: Partial<Variant>) => onChange({ variants: variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const total = variants.reduce((t, v) => t + (v.stock ?? 0), 0);
  const unused = SUGGESTIONS.filter((s) => !options.some((o) => o.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-col gap-5">
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>
          <span className="block font-medium">Count stock</span>
          <span className="block text-sm text-muted-foreground">Shows &quot;Only 3 left&quot;, and stops selling at zero.</span>
        </span>
        <Switch checked={track} onCheckedChange={(on) => onChange({ trackStock: on, ...(on && !variants.length && value.stock === undefined ? { stock: 0 } : {}) })} aria-label="Count stock" />
      </label>

      {track && !variants.length && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-stock">In stock</Label>
          <Input id="p-stock" type="number" inputMode="numeric" min={0} className="max-w-40" value={value.stock ?? ""} onChange={(e) => onChange({ stock: e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value))) })} aria-invalid={!!errors?.stock || undefined} aria-describedby={errors?.stock ? "p-stock-err" : undefined} />
          {errors?.stock && <p id="p-stock-err" className="text-sm font-medium text-danger">{errors.stock}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t pt-4">
        <div>
          <p className="font-medium">Options</p>
          <p className="text-sm text-muted-foreground">Sizes, colours or other choices. Each combination becomes a variant with its own price, SKU and stock.</p>
        </div>
        {options.map((o, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-control border bg-surface-sunken p-3">
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`opt-${i}`}>Option name</Label>
                <Input id={`opt-${i}`} value={o.name} maxLength={40} placeholder="Size" onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove the ${o.name || "option"}`} onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`opt-${i}-v`}>Choices</Label>
              <ValuesInput id={`opt-${i}-v`} values={o.values} onChange={(values) => setOptions(options.map((x, j) => (j === i ? { ...x, values } : x)))} />
            </div>
          </div>
        ))}
        {errors?.options && <p role="alert" className="text-sm font-medium text-danger">{errors.options}</p>}
        {options.length < 3 && (
          <div className="flex flex-wrap gap-2">
            {unused.slice(0, options.length ? 2 : 3).map((name) => (
              <Button key={name} type="button" variant="secondary" size="sm" onClick={() => setOptions([...options, { name, values: [] }])}>
                <Plus aria-hidden /> {name}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, { name: "", values: [] }])}>
              <Plus aria-hidden /> Another option
            </Button>
          </div>
        )}
      </div>

      {variants.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {variants.length} variant{variants.length === 1 ? "" : "s"}
            </p>
            {track && <p className="text-sm text-muted-foreground">{total.toLocaleString("en-IN")} in stock in all</p>}
          </div>
          {combinations(options.filter((o) => o.values.length)).length > MAX_VARIANTS && <p className="text-sm font-medium text-warning-ink">That&apos;s more than {MAX_VARIANTS} combinations; only the first {MAX_VARIANTS} are kept.</p>}
          <ul className="flex flex-col divide-y rounded-control border">
            {variants.map((v, i) => (
              <li key={v.id} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_7rem_6rem] sm:items-center">
                <span className="col-span-2 text-sm font-semibold sm:col-span-1">{v.title}</span>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`var-${i}-price`} className="text-xs text-muted-foreground sm:sr-only">Price</Label>
                  <CurrencyInput id={`var-${i}-price`} currency={currency} value={v.price} onChange={(m) => setVariant(i, { price: m ? { ...m, currency } : { amount: 0, currency } })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`var-${i}-sku`} className="text-xs text-muted-foreground sm:sr-only">SKU</Label>
                  <Input id={`var-${i}-sku`} value={v.sku} maxLength={32} placeholder="SKU" className="font-mono" onChange={(e) => setVariant(i, { sku: e.target.value })} />
                </div>
                {track ? (
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`var-${i}-stock`} className="text-xs text-muted-foreground sm:sr-only">Stock</Label>
                    <Input id={`var-${i}-stock`} type="number" inputMode="numeric" min={0} value={v.stock ?? 0} onChange={(e) => setVariant(i, { stock: Math.max(0, Math.round(Number(e.target.value) || 0)) })} aria-label={`Stock of ${v.title}`} />
                  </div>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </li>
            ))}
          </ul>
          {errors?.variants && <p role="alert" className="text-sm font-medium text-danger">{errors.variants}</p>}
          <p className="text-xs text-muted-foreground">The product&apos;s own price is shown on cards; each variant sells at its price.</p>
        </div>
      )}
    </div>
  );
}
