"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { money } from "@/lib/money";
import type { Money, ProductImage } from "@/lib/types";
import { MoneyText } from "./money-text";
import { ProductImageView } from "./product-cover";

/**
 * Cart pieces for PHYSICAL products (later phase). Digital stores never render these:
 * every digital product goes straight to checkout with Buy now.
 */
export interface CartLine {
  id: string;
  title: string;
  image?: ProductImage;
  unit: Money;
  qty: number;
}

export function CartLines({ lines, onQty, onRemove }: { lines: CartLine[]; onQty: (id: string, qty: number) => void; onRemove: (id: string) => void }) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <ShoppingBag className="size-6" aria-hidden /> Your bag is empty.
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {lines.map((l) => (
        <li key={l.id} className="flex gap-3 py-3">
          <ProductImageView image={l.image} size="xs" className="w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{l.title}</p>
            <MoneyText value={l.unit} className="text-sm text-muted-foreground" />
            <div className="mt-2 flex items-center gap-1">
              <Button variant="secondary" size="icon-sm" aria-label={`One less ${l.title}`} disabled={l.qty <= 1} onClick={() => onQty(l.id, l.qty - 1)}><Minus /></Button>
              <span className="w-8 text-center font-mono text-sm" aria-live="polite">{l.qty}</span>
              <Button variant="secondary" size="icon-sm" aria-label={`One more ${l.title}`} onClick={() => onQty(l.id, l.qty + 1)}><Plus /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${l.title}`} className="ml-auto" onClick={() => onRemove(l.id)}><Trash2 /></Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function cartTotal(lines: CartLine[]): Money {
  return money(lines.reduce((t, l) => t + l.unit.amount * l.qty, 0), lines[0]?.unit.currency ?? "INR");
}

export function CartDrawer({
  open,
  onOpenChange,
  lines,
  onQty,
  onRemove,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lines: CartLine[];
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Your bag</SheetTitle>
          <SheetDescription>Physical products ship from the creator. Digital ones use Buy now.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4"><CartLines lines={lines} onQty={onQty} onRemove={onRemove} /></div>
        <SheetFooter>
          <div className="flex items-center justify-between font-semibold"><span>Subtotal</span><MoneyText value={cartTotal(lines)} /></div>
          <Button size="lg" disabled={lines.length === 0} onClick={onCheckout}>Checkout</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
