"use client";

import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckoutDeals } from "@/lib/types";
import { priceInfo, ratingSummary } from "@/lib/pricing";
import { evaluateDeals } from "@/lib/pricing/deals";
import type { Deal, DealRule, OrderItem, Product } from "@/lib/types";
import { DealPanel } from "./deal-panel";
import { MoneyText } from "./money-text";

/**
 * Test mode for deal paths: pick what a buyer has in their order and see exactly what the
 * checkout panel would show, using the same engine as checkout. Nothing is saved or charged.
 */
export function DealPreview({ rules, products, storeDeals = [], now }: { rules: DealRule[]; products: Product[]; storeDeals?: Deal[]; now: number }) {
  const live = useMemo(() => products.filter((p) => p.status === "published"), [products]);
  const [cart, setCart] = useState<string[]>(() => (live[0] ? [live[0].id] : []));
  const [added, setAdded] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState(false);

  const result = useMemo(
    () =>
      evaluateDeals({
        lines: [...cart, ...added].map((productId) => ({ productId })),
        rules,
        products: live.map((p) => ({ id: p.id, title: p.title, price: priceInfo(p, storeDeals, now).price, floor: p.priceFloor })),
        giftChoices: choices,
        now,
      }),
    [cart, added, rules, live, storeDeals, choices, now]
  );

  const deals: CheckoutDeals = {
    offers: result.offers,
    pendingChoices: result.pendingChoices,
    saving: result.saving,
    rules,
    products: live.map((p) => ({ ...p, info: priceInfo(p, storeDeals, now), rating: ratingSummary([]) })),
    skipped,
  };
  const items: OrderItem[] = result.lines.map((l, i) => ({
    productId: l.productId,
    title: l.title,
    price: l.price,
    basePrice: l.basePrice,
    kind: i < cart.length ? "product" : "deal",
    free: l.free,
    gift: l.gift,
    ruleIds: l.ruleIds,
  }));

  return (
    <section aria-labelledby="dp-heading" className="flex flex-col gap-4 rounded-card border bg-surface-sunken p-4">
      <div>
        <h2 id="dp-heading" className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
          <FlaskConical className="size-4 text-primary" aria-hidden /> Test mode
        </h2>
        <p className="text-xs text-muted-foreground">Pick what a buyer came to buy. This is exactly what they&apos;d see at checkout.</p>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="eyebrow mb-1">Buyer&apos;s order</legend>
        <div className="flex max-h-48 flex-col overflow-y-auto rounded-control border bg-surface">
          {live.map((p) => (
            <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b px-3 text-sm last:border-b-0">
              <Checkbox
                checked={cart.includes(p.id)}
                onCheckedChange={(v) => {
                  setCart((c) => (v ? [...c, p.id] : c.filter((x) => x !== p.id)));
                  setAdded((a) => a.filter((x) => x !== p.id));
                }}
                aria-label={p.title}
              />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{p.title}</span>
              <MoneyText value={priceInfo(p, storeDeals, now).price} mono className="shrink-0 text-xs" />
            </label>
          ))}
        </div>
      </fieldset>

      {cart.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pick at least one product.</p>
      ) : (
        <>
          <DealPanel
            idPrefix="preview"
            deals={deals}
            items={items}
            added={added}
            giftChoices={choices}
            currency="INR"
            onAdd={(ids) => setAdded((a) => [...a, ...ids.filter((id) => !a.includes(id) && !cart.includes(id))])}
            onRemove={(id) => setAdded((a) => a.filter((x) => x !== id))}
            onGift={(ruleId, productId) => setChoices((c) => ({ ...c, [ruleId]: productId }))}
            onSkip={setSkipped}
          />
          {!result.offers.length && !result.saving.amount && !result.pendingChoices.length && (
            <p className="rounded-control border border-dashed bg-surface px-3 py-3 text-sm text-muted-foreground">No deal for this order. Try different products, or check the rule&apos;s dates and that it&apos;s switched on.</p>
          )}
          <dl className="grid grid-cols-3 gap-2 rounded-control border bg-surface p-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Before deals</dt><dd><MoneyText value={result.subtotal} mono /></dd></div>
            <div><dt className="text-xs text-muted-foreground">Savings</dt><dd className="text-success"><MoneyText value={result.saving} mono /></dd></div>
            <div><dt className="text-xs text-muted-foreground">Buyer pays</dt><dd className="font-semibold"><MoneyText value={result.total} mono /></dd></div>
          </dl>
        </>
      )}
    </section>
  );
}
