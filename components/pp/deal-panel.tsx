"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckoutDeals } from "@/lib/types";
import { localPrice, money } from "@/lib/money";
import type { CurrencyCode, OrderItem } from "@/lib/types";
import { DealCard, GiftPicker, SavingsMeter } from "./deal-parts";
import { MoneyText } from "./money-text";
import { ProductImageView } from "./product-cover";

export const VISIBLE_DEALS = 3;

/**
 * "Build your deal" at checkout. Nothing is pre-selected: every item is the buyer's choice, and any
 * of them can be removed. Shows the three best offers (See more for the rest), a savings meter,
 * gift pickers, and a one-click skip. It lives beside the order, never above the Pay button,
 * so the Pay button doesn't move as deals are added or removed.
 */
export function DealPanel({
  deals,
  items,
  added,
  giftChoices,
  currency,
  busy,
  onAdd,
  onRemove,
  onGift,
  onSkip,
  idPrefix = "deal",
}: {
  deals: CheckoutDeals;
  /** Current order lines, to show what the deals did */
  items: OrderItem[];
  added: string[];
  giftChoices?: Record<string, string>;
  currency: CurrencyCode;
  busy?: boolean;
  onAdd: (productIds: string[]) => void;
  onRemove: (productId: string) => void;
  onGift: (ruleId: string, productId: string) => void;
  onSkip: (skip: boolean) => void;
  idPrefix?: string;
}) {
  const [more, setMore] = useState(false);
  const productById = (id: string) => deals.products.find((p) => p.id === id);
  const titleOf = (id: string) => productById(id)?.title ?? items.find((i) => i.productId === id)?.title ?? "a product";
  const ruleById = (id: string) => deals.rules.find((r) => r.id === id);
  const adds = deals.offers.filter((o) => o.kind === "add");
  const choiceRules = deals.rules.filter((r) => r.kind === "choose_gift" && (deals.pendingChoices.includes(r.id) || giftChoices?.[r.id]));
  const visible = more ? adds : adds.slice(0, VISIBLE_DEALS);
  const best = adds[0]?.saving ?? money(0);
  // Gifts from a pick-one rule already show in their GiftPicker
  const gifts = items.filter((i) => i.gift && !i.ruleIds?.some((id) => ruleById(id)?.kind === "choose_gift"));
  const headingId = `${idPrefix}-heading`;

  if (deals.skipped) {
    return (
      <section aria-label="Deals" className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-dashed bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">Deals hidden.</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSkip(false)} disabled={busy}>
          <Sparkles aria-hidden /> Show deals
        </Button>
      </section>
    );
  }

  if (!adds.length && !added.length && !choiceRules.length && !gifts.length) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-card border border-accent/40 bg-surface p-4" aria-busy={busy || undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
            <Sparkles className="size-4 text-accent-ink" aria-hidden /> Build your deal
          </h2>
          <p className="text-xs text-muted-foreground">Optional. You always get the best price for what&apos;s in your order.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSkip(true)} disabled={busy} className="shrink-0 text-muted-foreground">
          No thanks
        </Button>
      </div>

      <SavingsMeter saved={deals.saving} potential={best} currency={currency} />

      {choiceRules.map((r) =>
        r.kind === "choose_gift" ? (
          <GiftPicker
            key={r.id}
            idPrefix={`${idPrefix}-${r.id}`}
            title={giftChoices?.[r.id] ? "Your free gift" : "You've unlocked a free gift. Pick one:"}
            options={r.giftIds.map(productById).filter((p): p is NonNullable<typeof p> => !!p)}
            selected={giftChoices?.[r.id]}
            currency={currency}
            disabled={busy}
            onPick={(id) => onGift(r.id, id)}
          />
        ) : null
      )}

      {gifts.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Free gifts in your order">
          {gifts.map((g) => (
            <li key={g.productId} className="flex items-center gap-3 rounded-control bg-success-soft px-3 py-2 text-sm">
              <ProductImageView image={productById(g.productId)?.images[0]} size="xs" className="w-10 shrink-0" />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{g.title}</span>
              <span className="shrink-0">
                <s className="text-muted-foreground"><MoneyText value={localPrice(g.basePrice ?? g.price, currency)} /></s>{" "}
                <span className="font-semibold text-success">Free</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {added.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Added by you</p>
          <ul className="flex flex-col gap-2">
            {added.map((id) => {
              const p = productById(id);
              const line = items.find((i) => i.productId === id && i.kind === "deal");
              if (!p) return null;
              return (
                <li key={id} className="flex items-center gap-3 rounded-control border px-3 py-2">
                  <ProductImageView image={p.images[0]} size="xs" className="w-10 shrink-0" />
                  <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{p.title}</span>
                  {line && <MoneyText value={localPrice(line.price, currency)} mono className="shrink-0 text-sm" />}
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(id)} disabled={busy} aria-label={`Remove ${p.title}`}>
                    <X />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {adds.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2" aria-label="Deals you can add">
            {visible.map((o) => (
              <DealCard key={`${o.ruleId}:${o.addProductIds.join(",")}`} offer={o} rule={ruleById(o.ruleId)} products={deals.products} currency={currency} busy={busy} onAdd={onAdd} titleOf={titleOf} />
            ))}
          </ul>
          {adds.length > VISIBLE_DEALS && (
            <Button type="button" variant="link" className="self-start" aria-expanded={more} onClick={() => setMore((m) => !m)}>
              <ChevronDown aria-hidden className={more ? "rotate-180" : undefined} />
              {more ? "Show fewer" : `See ${adds.length - VISIBLE_DEALS} more`}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
