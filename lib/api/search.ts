import { phoneDigits } from "../mask";
import type { SearchFilters, SearchGroup, SearchResponse, SearchResult, SearchScope, SearchType } from "../types";
import { getOffers, getQuestionsInbox, getReviewsInbox } from "./store-admin";
import { getOrders, getCustomers } from "./orders";
import { getPayouts } from "./payouts";
import { getProducts } from "./products";
import { getStore } from "./store";

/**
 * Global search (Part 4A). One index over the creator's own store: products, orders, buyers, invoices,
 * reviews, questions, coupons and payouts, read from the database.
 * Pure helpers (`classify`, `runSearch`) are exported for tests.
 */

export const TYPE_LABELS: Record<SearchType, string> = {
  creator: "Creators",
  store: "Stores",
  product: "Products",
  order: "Orders",
  buyer: "Buyers",
  payout: "Payouts",
  dispute: "Refunds and disputes",
  review: "Reviews",
  question: "Questions",
  coupon: "Coupons",
  invoice: "Invoices",
  flag: "Flags",
};

export const TYPE_ORDER: SearchType[] = ["order", "buyer", "product", "store", "creator", "invoice", "dispute", "payout", "review", "question", "coupon", "flag"];

/** Types a creator can search in their own store */
export const CREATOR_TYPES: SearchType[] = ["order", "buyer", "product", "invoice", "dispute", "payout", "review", "question", "coupon"];

export interface Indexed extends SearchResult {
  /** Lowercased text to match words against */
  text: string;
  /** Raw contact values, for matching only; never returned */
  rawEmails: string[];
  rawPhones: string[];
  number?: string;
}

/* ------------------------------------------------------------------ */
/* Query patterns                                                       */
/* ------------------------------------------------------------------ */

export type Pattern =
  | { kind: "order"; digits: string }
  | { kind: "invoice"; value: string }
  | { kind: "email"; value: string }
  | { kind: "phone"; digits: string }
  | { kind: "store"; slug: string; rest: string }
  | { kind: "text"; words: string[] };

export function classify(raw: string): Pattern {
  const q = raw.trim();
  const order = q.match(/^(?:#|pp-?)\s*(\d{2,7})$/i) ?? q.match(/^(\d{3,6})$/);
  if (order) return { kind: "order", digits: order[1] };
  if (/^inv-?\d+/i.test(q)) return { kind: "invoice", value: q.toUpperCase().replace(/^INV-?/, "INV-") };
  const store = q.match(/^@([a-z0-9-]+)\s*(.*)$/i);
  if (store) return { kind: "store", slug: store[1].toLowerCase(), rest: store[2] };
  if (/^[^\s@]+@\S*$/.test(q)) return { kind: "email", value: q.toLowerCase() };
  if (/^\+?[\d\s-]{7,}$/.test(q)) return { kind: "phone", digits: phoneDigits(q) };
  return { kind: "text", words: q.toLowerCase().split(/\s+/).filter(Boolean) };
}

function matches(item: Indexed, p: Pattern): boolean {
  switch (p.kind) {
    case "order":
      return !!item.number && item.number.replace(/\D/g, "") === p.digits;
    case "invoice":
      return item.type === "invoice" && item.title.toUpperCase().startsWith(p.value);
    case "email":
      return item.rawEmails.some((e) => e.includes(p.value));
    case "phone":
      return item.rawPhones.some((ph) => ph.endsWith(p.digits) || ph.includes(p.digits));
    case "store":
      if (item.storeSlug !== p.slug && !(item.type === "store" && item.id === p.slug) && !(item.type === "creator" && item.storeSlug === p.slug)) return false;
      return p.rest ? matches(item, classify(p.rest)) : true;
    case "text":
      return p.words.length > 0 && p.words.every((w) => item.text.includes(w));
  }
}

/* ------------------------------------------------------------------ */
/* Index                                                                */
/* ------------------------------------------------------------------ */

function text(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** The active store's records as search entries. */
async function buildIndex(): Promise<Indexed[]> {
  const [store, products, orders, customers, reviews, questions, offers, payouts] = await Promise.all([getStore(), getProducts(), getOrders(), getCustomers(), getReviewsInbox(), getQuestionsInbox(), getOffers(), getPayouts()]);
  const slug = store.slug;
  const base = { storeSlug: slug, storeName: store.name };
  const productSlug = (id: string) => products.find((p) => p.id === id)?.slug ?? "";
  const out: Indexed[] = [];

  for (const p of products) {
    out.push({ ...base, type: "product", id: p.id, title: p.title, subtitle: `${p.sku ? `${p.sku} · ` : ""}${p.kind}`, status: p.status, amount: p.price, date: p.createdAt, href: `/catalog/products/${p.id}`, text: text(p.title, p.sku, p.slug, p.kind, p.id), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
  }

  for (const o of orders) {
    out.push({
      ...base,
      email: o.buyerEmail || undefined,
      phone: o.buyerPhone,
      rawEmails: o.buyerEmail ? [o.buyerEmail.toLowerCase()] : [],
      rawPhones: o.buyerPhone ? [phoneDigits(o.buyerPhone)] : [],
      type: "order",
      id: o.id,
      number: o.number,
      title: o.number,
      subtitle: `${o.buyerName || "Checkout started"} · ${o.productTitle}`,
      status: o.status,
      amount: o.buyerTotal,
      date: o.createdAt,
      href: `/sales/orders/${o.id}`,
      text: text(o.number, o.buyerName, o.productTitle, o.id, o.couponCode),
      actions: ["open", "copy"],
    });
    if (o.invoiceNumber) {
      out.push({ ...base, type: "invoice", id: o.id, title: o.invoiceNumber, subtitle: `${o.number} · ${o.buyerName}`, status: o.status, amount: o.buyerTotal, date: o.paidAt ?? o.createdAt, href: `/sales/orders/${o.id}`, text: text(o.invoiceNumber, o.number, o.buyerName), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
    }
    if (o.status === "refund_requested" || o.status === "refunded") {
      out.push({ ...base, type: "dispute", id: `rf_${o.id}`, number: o.number, title: `Refund · ${o.number}`, subtitle: o.refundReason ?? o.productTitle, status: o.status, amount: o.buyerTotal, date: o.refundedAt ?? o.createdAt, href: `/sales/orders/${o.id}`, text: text("refund", o.number, o.buyerName, o.refundReason), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
    }
  }

  for (const c of customers) {
    const phone = orders.find((o) => o.customerId === c.id && o.buyerPhone)?.buyerPhone;
    out.push({ ...base, email: c.email, phone, rawEmails: [c.email.toLowerCase()], rawPhones: phone ? [phoneDigits(phone)] : [], type: "buyer", id: c.id, title: c.name, subtitle: `${c.ordersCount} order${c.ordersCount === 1 ? "" : "s"} · ${c.country}`, amount: c.totalSpent, date: c.lastOrderAt, href: `/sales/customers/${c.id}`, text: text(c.name, c.country, c.id), actions: ["open", "copy"] });
  }

  for (const r of reviews) {
    out.push({ ...base, type: "review", id: r.id, title: r.title || `${r.rating}★ review`, subtitle: `${r.rating}★ · ${r.author}`, status: r.hidden ? "hidden" : "shown", date: r.createdAt, href: "/store/current/reviews", text: text(r.title, r.body, r.author), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
  }

  for (const q of questions) {
    out.push({ ...base, type: "question", id: q.id, title: q.body.length > 80 ? `${q.body.slice(0, 80)}…` : q.body, subtitle: `${q.asker} · ${q.answers.length ? "answered" : "waiting"}`, status: q.hidden ? "hidden" : q.answers.length ? "answered" : "open", date: q.createdAt, href: "/store/current/questions", text: text(q.body, q.asker), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
    void productSlug;
  }

  for (const c of offers.coupons) {
    out.push({ ...base, type: "coupon", id: c.id, title: c.code, subtitle: `${c.kind === "percent" ? `${c.value}% off` : "Fixed amount off"} · used ${c.used}${c.usageLimit ? ` of ${c.usageLimit}` : ""}`, status: c.active ? "active" : "inactive", href: "/store/current/offers/coupons", text: text(c.code), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
  }

  for (const p of payouts) {
    out.push({ ...base, type: "payout", id: p.id, title: `Payout ${p.reference ?? p.id.slice(0, 8)}`, subtitle: p.methodLabel, status: p.status, amount: p.amount, date: p.createdAt, href: "/sales/payouts/balance", text: text("payout", p.reference, p.methodLabel, p.id), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Search                                                               */
/* ------------------------------------------------------------------ */

/** Drops the match-only fields (raw contact details never leave the api) */
function strip(i: Indexed): SearchResult {
  const r: Partial<Indexed> = { ...i };
  delete r.text;
  delete r.rawEmails;
  delete r.rawPhones;
  delete r.number;
  return r as SearchResult;
}

/** Pure search over a prepared index. `perGroup` limits results per group (palette shows 5). */
export function runSearch(items: Indexed[], query: string, filters: SearchFilters = {}, perGroup = 5, now = Date.now()): SearchResponse {
  const p = classify(query);
  const pattern: SearchResponse["pattern"] = p.kind === "text" ? "text" : p.kind;
  const since = filters.days ? now - filters.days * 86_400_000 : undefined;
  const hit = items.filter(
    (i) =>
      (!filters.types?.length || filters.types.includes(i.type)) &&
      (!filters.status || i.status === filters.status) &&
      (!filters.storeSlug || i.storeSlug === filters.storeSlug) &&
      (!since || (i.date ? Date.parse(i.date) >= since : false)) &&
      matches(i, p)
  );
  const exact = (i: Indexed) => (p.kind === "text" && i.title.toLowerCase() === p.words.join(" ") ? 0 : 1);
  const groups: SearchGroup[] = TYPE_ORDER.map((type) => {
    const all = hit.filter((i) => i.type === type).sort((a, b) => exact(a) - exact(b) || (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
    return { type, label: TYPE_LABELS[type], total: all.length, results: all.slice(0, perGroup).map(strip) };
  }).filter((g) => g.total > 0);
  return { query, pattern, groups, total: hit.length };
}

export async function search(query: string, opts: { scope?: SearchScope; filters?: SearchFilters; perGroup?: number } = {}): Promise<SearchResponse> {
  if (!query.trim()) return { query, pattern: "text", groups: [], total: 0 };
  const filters = { ...opts.filters, types: (opts.filters?.types?.length ? opts.filters.types : CREATOR_TYPES).filter((t) => CREATOR_TYPES.includes(t)) };
  return runSearch(await buildIndex(), query, filters, opts.perGroup ?? 5);
}
