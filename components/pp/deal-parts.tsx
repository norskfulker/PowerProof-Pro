"use client";

import { Check, Gift, Layers, Percent, Plus, ShoppingBag, Sparkles, Timer, TrendingUp, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatMoney, localPrice } from "@/lib/money";
import { ruleSummary, type DealOffer } from "@/lib/pricing/deals";
import type { CurrencyCode, DealRule, DealRuleKind, Money, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoneyText } from "./money-text";
import { ProductImageView } from "./product-cover";

const KIND_ICON: Record<DealRuleKind, LucideIcon> = {
  bundle_discount: Layers,
  free_gift: Gift,
  choose_gift: Gift,
  tiers: TrendingUp,
  spend_threshold: ShoppingBag,
  buy_x_get_cheapest: Sparkles,
  limited_time: Timer,
};

export const KIND_LABEL: Record<DealRuleKind, string> = {
  bundle_discount: "Bundle discount",
  free_gift: "Free gift",
  choose_gift: "Choose a gift",
  tiers: "Volume tiers",
  spend_threshold: "Spend threshold",
  buy_x_get_cheapest: "Cheapest free",
  limited_time: "Limited time",
};

/** Compact, readable description of a rule with an icon per type. */
export function RuleSummaryChip({ rule, titleOf, className }: { rule: DealRule; titleOf?: (id: string) => string; className?: string }) {
  const Icon = KIND_ICON[rule.kind] ?? Percent;
  return (
    <span className={cn("inline-flex max-w-full items-start gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink", className)}>
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 [overflow-wrap:anywhere]">{ruleSummary(rule, titleOf, (m) => formatMoney(m).replace(".00", ""))}</span>
    </span>
  );
}

/**
 * How much the buyer is saving now, against the most they could save with the best offer.
 * Announces changes politely so screen reader users hear the new saving after adding a deal.
 */
export function SavingsMeter({ saved, potential, currency, className }: { saved: Money; potential: Money; currency: CurrencyCode; className?: string }) {
  const max = Math.max(saved.amount + potential.amount, 1);
  const pct = Math.round((saved.amount / max) * 100);
  const s = localPrice(saved, currency);
  const more = localPrice(potential, currency);
  const text = saved.amount > 0 ? `You're saving ${formatMoney(s)}` : potential.amount > 0 ? "Add a deal to start saving" : "No deals for this order";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold" aria-live="polite">
          {saved.amount > 0 ? (
            <>
              You&apos;re saving <MoneyText value={s} className="text-success" />
            </>
          ) : (
            text
          )}
        </p>
        {potential.amount > 0 && (
          <p className="text-xs text-muted-foreground">
            Up to <MoneyText value={more} /> more below
          </p>
        )}
      </div>
      <div
        role="meter"
        aria-label="Savings"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${text}${potential.amount > 0 ? `, up to ${formatMoney(more)} more available` : ""}`}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-success transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** One suggestion: what to add, what it costs, what it saves. */
export function DealCard({
  offer,
  rule,
  products,
  currency,
  onAdd,
  busy,
  titleOf,
}: {
  offer: DealOffer;
  rule?: DealRule;
  products: Product[];
  /** Names products in the rule summary, including ones already in the order */
  titleOf?: (id: string) => string;
  currency: CurrencyCode;
  onAdd: (ids: string[]) => void;
  busy?: boolean;
}) {
  const items = offer.addProductIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
  const names = items.map((p) => p.title).join(" + ");
  const saving = localPrice(offer.saving, currency);
  const cost = localPrice(offer.extraCost, currency);
  const progress = offer.progress;
  return (
    <li className="flex flex-col gap-3 rounded-card border bg-surface p-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex shrink-0 -space-x-3">
          {items.slice(0, 2).map((p) => (
            <ProductImageView key={p.id} image={p.images[0]} size="xs" className="w-14 ring-2 ring-surface" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-semibold [overflow-wrap:anywhere]">Add {names}</p>
          <p className="text-sm">
            <span className="font-semibold text-success">Save <MoneyText value={saving} /></span>
            <span className="text-muted-foreground"> · adds <MoneyText value={cost} /></span>
          </p>
          {rule && <RuleSummaryChip rule={rule} titleOf={titleOf ?? ((id) => products.find((p) => p.id === id)?.title ?? "a product")} className="self-start" />}
        </div>
      </div>
      {progress && progress.current.amount < progress.target.amount && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((progress.current.amount / progress.target.amount) * 100))}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            <MoneyText value={localPrice({ ...progress.target, amount: progress.target.amount - progress.current.amount }, currency)} /> away
          </p>
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onAdd(offer.addProductIds)} aria-label={`Add ${names} and save ${formatMoney(saving)}`} className="self-start">
        <Plus aria-hidden /> Add to order
      </Button>
    </li>
  );
}

/** Pick one free gift. Each option shows its normal price struck through and "Free". */
export function GiftPicker({
  title,
  options,
  selected,
  currency,
  onPick,
  disabled,
  idPrefix = "gift",
}: {
  title: string;
  options: Product[];
  selected?: string;
  currency: CurrencyCode;
  onPick: (productId: string) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  return (
    <fieldset className="@container flex flex-col gap-2 rounded-card border border-accent/50 bg-accent-soft/40 p-3.5" disabled={disabled}>
      <legend className="sr-only">{title}</legend>
      <p className="flex items-center gap-2 text-sm font-semibold" aria-hidden>
        <Gift className="size-4 text-accent-ink" /> {title}
      </p>
      <RadioGroup value={selected ?? ""} onValueChange={onPick} className="grid grid-cols-1 gap-2 @lg:grid-cols-2" aria-label={title}>
        {options.map((p) => (
          <label
            key={p.id}
            htmlFor={`${idPrefix}-${p.id}`}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-control border bg-surface p-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
          >
            <RadioGroupItem id={`${idPrefix}-${p.id}`} value={p.id} aria-label={`${p.title}, free`} />
            <ProductImageView image={p.images[0]} size="xs" className="w-12 shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium [overflow-wrap:anywhere]">{p.title}</span>
              <span className="text-xs">
                <s className="text-muted-foreground">
                  <MoneyText value={localPrice(p.price, currency)} />
                </s>{" "}
                <span className="font-semibold text-success">Free</span>
              </span>
            </span>
            {selected === p.id && <Check className="ml-auto size-4 shrink-0 text-primary" aria-hidden />}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
