"use client";

import { useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/pp/currency-input";
import { MoneyText } from "@/components/pp/money-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updateProduct, updateVariant } from "@/lib/api";
import type { Money, Product, ProductVariant } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Units left: the product's own count, or all its variants together; undefined when not counted */
export function stockOf(p: Product): number | undefined {
  if (p.fulfilment !== "physical" || !p.trackStock) return undefined;
  return p.variants?.length ? p.variants.reduce((t, v) => t + (v.stock ?? 0), 0) : (p.stock ?? 0);
}
/** At or below its low-stock level (5 unless set on the product) */
export const isLow = (p: Product) => {
  const n = stockOf(p);
  return n !== undefined && n <= (p.lowStockAt ?? 5);
};

const saveError = (e: unknown) => toast.error("That didn't save", { description: e instanceof Error ? e.message : undefined });

/** Click the price to change it; Enter or leaving the field saves, Escape cancels */
export function InlinePrice({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<Money | undefined>(product.price);
  const [busy, setBusy] = useState(false);
  // Escape cancels, even though removing the box blurs it
  const cancelled = useRef(false);

  async function save() {
    if (cancelled.current || !value || value.amount === product.price.amount) return setEditing(false);
    setBusy(true);
    try {
      await updateProduct(product.id, { price: value });
      toast.success("Price saved", { description: product.title });
      onSaved();
      setEditing(false);
    } catch (e) {
      saveError(e);
    }
    setBusy(false);
  }

  if (!editing) {
    return (
      <Button type="button" variant="ghost" size="sm" className="group -mr-2 font-mono font-medium" onClick={(e) => { e.stopPropagation(); cancelled.current = false; setValue(product.price); setEditing(true); }} aria-label={`Change price of ${product.title}`}>
        <MoneyText value={product.price} mono />
        <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
      </Button>
    );
  }
  return (
    <div
      className="ml-auto w-36"
      // Typing starts straight away; leaving the box saves, Escape cancels
      ref={(el) => { const input = el?.querySelector("input"); if (input && document.activeElement !== input) input.focus(); }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") { cancelled.current = true; setEditing(false); } }}
    >
      <CurrencyInput value={value} onChange={setValue} currency={product.price.currency} onBlur={() => void save()} />
      {busy && <Loader2 className="mt-1 ml-auto size-3.5 animate-spin" aria-label="Saving" />}
    </div>
  );
}

/** A number box that saves when you leave it or press Enter */
function StockBox({ value, label, onSave }: { value: number; label: string; onSave: (n: number) => Promise<void> }) {
  const [text, setText] = useState(String(value));
  const commit = async () => {
    const n = Number.parseInt(text, 10);
    if (Number.isNaN(n) || n < 0) return setText(String(value));
    if (n !== value) await onSave(n);
  };
  return (
    <Input
      size="sm"
      inputMode="numeric"
      aria-label={label}
      className="w-20 text-right font-mono tabular"
      value={text}
      onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setText(String(value));
      }}
    />
  );
}

/** A price box that saves when you leave it */
function PriceBox({ value, label, onSave }: { value: Money; label: string; onSave: (m: Money) => Promise<void> }) {
  const [m, setM] = useState<Money | undefined>(value);
  return (
    <div aria-label={label} role="group">
      <CurrencyInput value={m} currency={value.currency} onChange={setM} onBlur={() => m && m.amount !== value.amount && void onSave(m)} />
    </div>
  );
}

/**
 * Stock in the list: a product's own count right in the cell, or each variant's count (and
 * price) in a small panel. Saved as you leave each box.
 */
export function InlineStock({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const left = stockOf(product);
  if (left === undefined) return <span className="text-muted-foreground">{product.fulfilment === "physical" ? "Not counted" : "—"}</span>;
  const tone = left === 0 ? "text-danger" : isLow(product) ? "text-warning-ink" : "";
  const saveProduct = async (n: number) => {
    try {
      await updateProduct(product.id, { stock: n });
      toast.success("Stock saved", { description: `${product.title}: ${n} left` });
      onSaved();
    } catch (e) {
      saveError(e);
    }
  };

  if (!product.variants?.length) {
    return (
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        {left === 0 && <span className="text-xs font-semibold text-danger">Sold out</span>}
        {left > 0 && isLow(product) && <span className="text-xs font-semibold text-warning-ink">Low</span>}
        <StockBox value={left} label={`Stock of ${product.title}`} onSave={saveProduct} />
      </div>
    );
  }

  const saveVariant = async (v: ProductVariant, patch: { stock?: number; price?: Money }) => {
    try {
      await updateVariant(v.id, patch);
      toast.success("Saved", { description: `${product.title} (${v.title})` });
      onSaved();
    } catch (e) {
      saveError(e);
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={cn("-mr-2 font-mono", tone)} onClick={(e) => e.stopPropagation()} aria-label={`Stock of ${product.title}, by variant`}>
          {left === 0 ? "Sold out" : `${left} left`} <Pencil className="size-3 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-sm font-semibold">{product.title}</p>
        <ul className="flex flex-col gap-2">
          {product.variants.map((v) => (
            <li key={v.id} className="grid grid-cols-[minmax(0,1fr)_8rem_5rem] items-center gap-2">
              <span className={cn("truncate text-sm", (v.stock ?? 0) <= (product.lowStockAt ?? 5) && "font-medium text-warning-ink")}>{v.title}</span>
              <PriceBox value={v.price} label={`Price of ${v.title}`} onSave={(m) => saveVariant(v, { price: m })} />
              <StockBox value={v.stock ?? 0} label={`Stock of ${v.title}`} onSave={(n) => saveVariant(v, { stock: n })} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Price and stock save as you leave each box.</p>
      </PopoverContent>
    </Popover>
  );
}
