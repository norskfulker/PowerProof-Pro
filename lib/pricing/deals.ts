import { money } from "../money";
import type { DealRule, Money } from "../types";

/**
 * Deal paths engine (Part 4B). Pure: same input, same output, no clock or storage access.
 *
 * Pricing rules
 * - Buyers always get the best valid price. By default that is the single best rule; rules marked
 *   stackable also combine with each other and with the best non-stackable rule, and the engine
 *   picks whichever combination saves the most.
 * - Percentage discounts never take a product below its price floor. "Free" mechanics (gifts,
 *   cheapest-free) are explicit creator choices and are not limited by the floor.
 * - A gift is free once per order: one free line per gift product, however many rules give it.
 * - Locked lines (the order bump, at its own special price) are never discounted further.
 * - Nothing is ever added for the buyer. The engine only suggests (offers) what to add.
 */

export interface DealProduct {
  id: string;
  title: string;
  /** Price before deal paths (after any store-wide sale), store currency */
  price: Money;
  floor?: Money;
}

export interface CartLine {
  productId: string;
  /** Overrides the catalogue price, e.g. the order bump's special price */
  price?: Money;
  /** Never discounted by deals */
  locked?: boolean;
}

export interface PricedLine {
  productId: string;
  title: string;
  basePrice: Money;
  price: Money;
  /** Free because of a gift or cheapest-free rule */
  free: boolean;
  /** Added by a gift rule (not by the buyer) */
  gift: boolean;
  locked: boolean;
  ruleIds: string[];
}

export interface DealOffer {
  ruleId: string;
  ruleName: string;
  /** What the buyer sees: "Add Monsoon Moods and save ₹450" is built by the UI from these fields */
  kind: "add" | "choose_gift" | "progress";
  addProductIds: string[];
  /** Extra saving if the buyer accepts, in store currency */
  saving: Money;
  /** Extra cost of the added products after the deal (what the total goes up by) */
  extraCost: Money;
  giftOptions?: string[];
  progress?: { current: Money; target: Money };
}

export interface DealResult {
  lines: PricedLine[];
  /** Sum of base prices, gifts included */
  subtotal: Money;
  /** Everything the deals took off, gift value included */
  saving: Money;
  total: Money;
  appliedRuleIds: string[];
  /** Every useful suggestion, best first. The panel shows three and a "See more". */
  offers: DealOffer[];
  /** Gift rules whose conditions are met but the buyer hasn't picked a gift yet */
  pendingChoices: string[];
}

export interface EvaluateInput {
  lines: CartLine[];
  rules: DealRule[];
  products: DealProduct[];
  /** ruleId → chosen gift product id, for choose_gift rules */
  giftChoices?: Record<string, string>;
  now: number;
}

/* ------------------------------------------------------------------ */

type Work = PricedLine & { order: number };

const pct = (amount: number, percent: number) => Math.round((amount * (100 - percent)) / 100);

export function isRuleLive(r: DealRule, now: number): boolean {
  if (!r.active) return false;
  if (r.startsAt && Date.parse(r.startsAt) > now) return false;
  if (r.endsAt && Date.parse(r.endsAt) <= now) return false;
  return true;
}

function paidLines(lines: Work[]) {
  return lines.filter((l) => !l.gift);
}

function sumBase(lines: Work[]) {
  return lines.reduce((t, l) => t + l.basePrice.amount, 0);
}

function inPool(pool: string[], id: string) {
  return pool.length === 0 || pool.includes(id);
}

function discount(line: Work, percent: number, floor: number | undefined, ruleId: string): number {
  if (line.locked || line.free) return 0;
  const target = Math.max(pct(line.price.amount, percent), Math.min(floor ?? 0, line.price.amount));
  const saved = line.price.amount - target;
  if (saved <= 0) return 0;
  line.price = money(target, line.price.currency);
  line.ruleIds.push(ruleId);
  return saved;
}

function makeFree(line: Work, ruleId: string): number {
  if (line.locked || line.free) return 0;
  const saved = line.price.amount;
  line.price = money(0, line.price.currency);
  line.free = true;
  line.ruleIds.push(ruleId);
  return saved;
}

function giveGift(lines: Work[], giftId: string, catalog: Map<string, DealProduct>, ruleId: string): number {
  const existingGift = lines.find((l) => l.productId === giftId && l.gift);
  if (existingGift) return 0;
  // The gift is already in the cart as something they'd pay for: make that one free instead
  const paid = lines.find((l) => l.productId === giftId && !l.free && !l.locked);
  if (paid) {
    paid.gift = true;
    return makeFree(paid, ruleId);
  }
  const p = catalog.get(giftId);
  if (!p) return 0;
  lines.push({ productId: p.id, title: p.title, basePrice: p.price, price: money(0, p.price.currency), free: true, gift: true, locked: false, ruleIds: [ruleId], order: lines.length });
  return p.price.amount;
}

/** Applies one rule in place. Returns the amount saved (0 = rule didn't apply). */
function applyRule(rule: DealRule, lines: Work[], catalog: Map<string, DealProduct>, choices: Record<string, string>): number {
  const floor = (id: string) => catalog.get(id)?.floor?.amount;
  const paid = paidLines(lines);
  const has = (id: string) => paid.some((l) => l.productId === id);
  const spend = sumBase(paid);
  switch (rule.kind) {
    case "bundle_discount": {
      if (rule.productIds.length < 2 || !rule.productIds.every(has)) return 0;
      let saved = 0;
      for (const id of rule.productIds) {
        const line = paid.find((l) => l.productId === id && !l.ruleIds.includes(rule.id));
        if (line) saved += discount(line, rule.percent, floor(id), rule.id);
      }
      return saved;
    }
    case "limited_time": {
      let saved = 0;
      for (const line of paid) if (rule.productIds.includes(line.productId)) saved += discount(line, rule.percent, floor(line.productId), rule.id);
      return saved;
    }
    case "tiers": {
      const pool = paid.filter((l) => inPool(rule.productIds, l.productId) && !l.locked);
      const tier = [...rule.tiers].sort((a, b) => b.minItems - a.minItems).find((t) => pool.length >= t.minItems);
      if (!tier) return 0;
      return pool.reduce((t, l) => t + discount(l, tier.percent, floor(l.productId), rule.id), 0);
    }
    case "spend_threshold": {
      if (spend < rule.minSpend.amount) return 0;
      return paid.reduce((t, l) => t + discount(l, rule.percent, floor(l.productId), rule.id), 0);
    }
    case "buy_x_get_cheapest": {
      const pool = paid.filter((l) => inPool(rule.productIds, l.productId) && !l.locked && !l.free);
      if (rule.buy < 2 || pool.length < rule.buy) return 0;
      // One free item per full group of `buy`, cheapest first
      const freeCount = Math.floor(pool.length / rule.buy);
      const cheapest = [...pool].sort((a, b) => a.price.amount - b.price.amount || a.order - b.order).slice(0, freeCount);
      return cheapest.reduce((t, l) => t + makeFree(l, rule.id), 0);
    }
    case "free_gift":
    case "choose_gift": {
      const triggered = rule.triggerIds.length === 0 ? paid.length > 0 : rule.triggerIds.some(has);
      if (!triggered || (rule.minSpend && spend < rule.minSpend.amount)) return 0;
      const giftId = rule.kind === "free_gift" ? rule.giftId : rule.giftIds.includes(choices[rule.id]) ? choices[rule.id] : undefined;
      if (!giftId) return 0;
      return giveGift(lines, giftId, catalog, rule.id);
    }
  }
}

function conditionsMet(rule: DealRule, lines: Work[]): boolean {
  if (rule.kind !== "choose_gift") return false;
  const paid = paidLines(lines);
  const triggered = rule.triggerIds.length === 0 ? paid.length > 0 : rule.triggerIds.some((id) => paid.some((l) => l.productId === id));
  return triggered && (!rule.minSpend || sumBase(paid) >= rule.minSpend.amount);
}

function startLines(input: EvaluateInput, catalog: Map<string, DealProduct>): Work[] {
  const out: Work[] = [];
  input.lines.forEach((l, i) => {
    const p = catalog.get(l.productId);
    if (!p) return;
    const base = l.price ?? p.price;
    out.push({ productId: p.id, title: p.title, basePrice: base, price: base, free: false, gift: false, locked: !!l.locked, ruleIds: [], order: i });
  });
  return out;
}

function runSet(rules: DealRule[], input: EvaluateInput, catalog: Map<string, DealProduct>): { lines: Work[]; saving: number; applied: string[] } {
  const lines = startLines(input, catalog);
  let saving = 0;
  const applied: string[] = [];
  // Item discounts first, then whole-order thresholds, then free items, then gifts
  const rank: Record<DealRule["kind"], number> = { bundle_discount: 0, limited_time: 0, tiers: 1, spend_threshold: 2, buy_x_get_cheapest: 3, free_gift: 4, choose_gift: 4 };
  for (const r of [...rules].sort((a, b) => rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id))) {
    const s = applyRule(r, lines, catalog, input.giftChoices ?? {});
    if (s > 0) {
      saving += s;
      applied.push(r.id);
    }
  }
  return { lines, saving, applied };
}

/** Best combination for a cart, without offers. */
function best(input: EvaluateInput, catalog: Map<string, DealProduct>) {
  const live = input.rules.filter((r) => isRuleLive(r, input.now));
  const stackable = live.filter((r) => r.stackable);
  const solo = live.filter((r) => !r.stackable);
  const sets: DealRule[][] = [[], ...live.map((r) => [r])];
  if (stackable.length > 1) sets.push(stackable);
  if (stackable.length) for (const r of solo) sets.push([r, ...stackable]);
  let winner = runSet([], input, catalog);
  for (const set of sets) {
    const res = runSet(set, input, catalog);
    // More saving wins; on a tie, fewer rules (simpler receipt)
    if (res.saving > winner.saving || (res.saving === winner.saving && res.applied.length < winner.applied.length && res.saving > 0)) winner = res;
  }
  return { ...winner, live };
}

function totals(lines: Work[]) {
  const cur = lines[0]?.basePrice.currency ?? "INR";
  const subtotal = lines.reduce((t, l) => t + l.basePrice.amount, 0);
  const total = lines.reduce((t, l) => t + l.price.amount, 0);
  return { subtotal: money(subtotal, cur), total: money(total, cur), saving: money(subtotal - total, cur) };
}

/** Product ids a buyer could add to move this rule forward, cheapest useful first. */
function candidateAdds(rule: DealRule, input: EvaluateInput, catalog: Map<string, DealProduct>, inCart: Set<string>): string[][] {
  const cheapest = (ids: string[]) =>
    ids
      .filter((id) => !inCart.has(id) && catalog.has(id))
      .sort((a, b) => catalog.get(a)!.price.amount - catalog.get(b)!.price.amount);
  const everything = [...catalog.keys()];
  switch (rule.kind) {
    case "bundle_discount": {
      const missing = rule.productIds.filter((id) => !inCart.has(id));
      return missing.length && missing.length < rule.productIds.length ? [missing] : [];
    }
    case "limited_time":
      return cheapest(rule.productIds).slice(0, 2).map((id) => [id]);
    case "tiers": {
      const pool = rule.productIds.length ? rule.productIds : everything;
      const have = input.lines.filter((l) => inPool(rule.productIds, l.productId) && !l.locked).length;
      const next = [...rule.tiers].sort((a, b) => a.minItems - b.minItems).find((t) => t.minItems > have);
      if (!next) return [];
      const need = next.minItems - have;
      const opts = cheapest(pool);
      return opts.length >= need ? [opts.slice(0, need)] : [];
    }
    case "buy_x_get_cheapest": {
      const pool = rule.productIds.length ? rule.productIds : everything;
      const have = input.lines.filter((l) => inPool(rule.productIds, l.productId) && !l.locked).length;
      const need = rule.buy - (have % rule.buy);
      const opts = cheapest(pool);
      return need > 0 && opts.length >= need ? [opts.slice(0, need)] : [];
    }
    case "spend_threshold":
    case "free_gift":
    case "choose_gift": {
      const spend = input.lines.filter((l) => !l.locked).reduce((t, l) => t + (l.price ?? catalog.get(l.productId)?.price ?? money(0)).amount, 0);
      const out: string[][] = [];
      if (rule.kind !== "spend_threshold" && rule.triggerIds.length && !rule.triggerIds.some((id) => inCart.has(id))) {
        const t = cheapest(rule.triggerIds)[0];
        if (t) out.push([t]);
      }
      const min = rule.kind === "spend_threshold" ? rule.minSpend : rule.minSpend;
      if (min && spend < min.amount) {
        const gap = min.amount - spend;
        const giftIds = rule.kind === "free_gift" ? [rule.giftId] : rule.kind === "choose_gift" ? rule.giftIds : [];
        // The cheapest single product that closes the gap (gifts excluded: they'd be free anyway)
        const closer = cheapest(everything).find((id) => !giftIds.includes(id) && catalog.get(id)!.price.amount >= gap);
        if (closer) out.push([closer]);
      }
      return out;
    }
  }
}

export function evaluateDeals(input: EvaluateInput): DealResult {
  const catalog = new Map(input.products.map((p) => [p.id, p]));
  const now = best(input, catalog);
  const cur = totals(now.lines);
  const inCart = new Set(input.lines.map((l) => l.productId));

  // For comparing offers, assume the buyer would pick the most valuable gift in any unchosen
  // choose_gift rule, so "spend a bit more to unlock a gift" counts what the gift is worth.
  const optimistic: Record<string, string> = { ...input.giftChoices };
  for (const r of input.rules) {
    if (r.kind !== "choose_gift" || (optimistic[r.id] && r.giftIds.includes(optimistic[r.id]))) continue;
    const top = r.giftIds.filter((id) => catalog.has(id)).sort((x, y) => catalog.get(y)!.price.amount - catalog.get(x)!.price.amount)[0];
    if (top) optimistic[r.id] = top;
  }
  const curOpt = totals(best({ ...input, giftChoices: optimistic }, catalog).lines);

  const offers: DealOffer[] = [];
  const seen = new Set<string>();
  for (const rule of now.live) {
    for (const add of candidateAdds(rule, input, catalog, inCart)) {
      const key = [...add].sort().join(",");
      if (seen.has(key)) continue;
      const next = best({ ...input, giftChoices: optimistic, lines: [...input.lines, ...add.map((productId) => ({ productId }))] }, catalog);
      const after = totals(next.lines);
      const gain = after.saving.amount - curOpt.saving.amount;
      if (gain <= 0) continue;
      seen.add(key);
      const minSpend = rule.kind === "spend_threshold" ? rule.minSpend : rule.kind === "free_gift" || rule.kind === "choose_gift" ? rule.minSpend : undefined;
      offers.push({
        ruleId: rule.id,
        ruleName: rule.name,
        kind: "add",
        addProductIds: add,
        saving: money(gain, cur.saving.currency),
        extraCost: money(after.total.amount - curOpt.total.amount, cur.total.currency),
        progress: minSpend ? { current: money(sumBase(paidLines(now.lines.filter((l) => !l.locked)))), target: minSpend } : undefined,
      });
    }
  }

  // Gift choices that are unlocked but not made yet
  const pendingChoices: string[] = [];
  for (const rule of now.live) {
    if (rule.kind !== "choose_gift" || now.applied.includes(rule.id) || !conditionsMet(rule, startLines(input, catalog))) continue;
    if (input.giftChoices?.[rule.id] && rule.giftIds.includes(input.giftChoices[rule.id])) continue;
    pendingChoices.push(rule.id);
    const options = rule.giftIds.filter((id) => catalog.has(id));
    const top = Math.max(0, ...options.map((id) => catalog.get(id)!.price.amount));
    offers.push({ ruleId: rule.id, ruleName: rule.name, kind: "choose_gift", addProductIds: [], saving: money(top, cur.saving.currency), extraCost: money(0, cur.total.currency), giftOptions: options });
  }

  offers.sort((a, b) => b.saving.amount - a.saving.amount || a.extraCost.amount - b.extraCost.amount || a.ruleId.localeCompare(b.ruleId));

  return {
    lines: now.lines.sort((a, b) => a.order - b.order).map((l) => ({ productId: l.productId, title: l.title, basePrice: l.basePrice, price: l.price, free: l.free, gift: l.gift, locked: l.locked, ruleIds: l.ruleIds })),
    subtotal: cur.subtotal,
    saving: cur.saving,
    total: cur.total,
    appliedRuleIds: now.applied,
    offers,
    pendingChoices,
  };
}

/** One-line, buyer-facing description of a rule, e.g. "Buy 3, get the cheapest free". */
export function ruleSummary(rule: DealRule, titleOf: (id: string) => string = (id) => id, fmt: (m: Money) => string = (m) => `₹${(m.amount / 100).toLocaleString("en-IN")}`): string {
  const list = (ids: string[]) => (ids.length === 0 ? "anything" : ids.length <= 2 ? ids.map(titleOf).join(" + ") : `${titleOf(ids[0])} and ${ids.length - 1} more`);
  switch (rule.kind) {
    case "bundle_discount":
      return `Buy ${list(rule.productIds)} together, save ${rule.percent}%`;
    case "limited_time":
      return `${list(rule.productIds)}: ${rule.percent}% off for a limited time`;
    case "tiers":
      return rule.tiers
        .slice()
        .sort((a, b) => a.minItems - b.minItems)
        .map((t) => `${t.minItems} items ${t.percent}% off`)
        .join(", ");
    case "spend_threshold":
      return `Spend ${fmt(rule.minSpend)}, get ${rule.percent}% off everything`;
    case "buy_x_get_cheapest":
      return `Buy ${rule.buy}, get the cheapest free`;
    case "free_gift":
      return `${rule.minSpend ? `Spend ${fmt(rule.minSpend)}` : rule.triggerIds.length ? `Buy ${list(rule.triggerIds)}` : "Any order"}: ${titleOf(rule.giftId)} free`;
    case "choose_gift":
      return `${rule.minSpend ? `Spend ${fmt(rule.minSpend)}` : rule.triggerIds.length ? `Buy ${list(rule.triggerIds)}` : "Any order"}: pick a free gift`;
  }
}
