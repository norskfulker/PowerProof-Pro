import { maskEmail, maskPhone, phoneDigits } from "../mask";
import { adminDb } from "../mock/admin";
import type { StoreScope } from "../mock/base";
import { commit, db } from "../mock/db";
import { uid } from "../mock/random";
import type { AuditEntry, QuickAction, SearchFilters, SearchGroup, SearchResponse, SearchResult, SearchScope, SearchType } from "../types";
import { ApiError, call, notFound } from "./client";
import { allScopes, isPrimary } from "./scope";

/**
 * Global search (Part 4A). One index over every entity the viewer may see; the admin scope covers
 * all stores and masks buyer contact details, the creator scope covers only the creator's own store.
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

interface Indexed extends SearchResult {
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

function contact(scope: SearchScope, email?: string, phone?: string) {
  const masked = scope === "admin";
  return {
    email: email ? (masked ? maskEmail(email) : email) : undefined,
    phone: phone ? (masked ? maskPhone(phone) : phone) : undefined,
    masked: masked && !!(email || phone),
    rawEmails: email ? [email.toLowerCase()] : [],
    rawPhones: phone ? [phoneDigits(phone)] : [],
  };
}

function text(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function scopeItems(sc: StoreScope, scope: SearchScope): Indexed[] {
  const primary = isPrimary(sc);
  const slug = sc.store.slug;
  const storeName = sc.store.name;
  const base = { storeSlug: slug, storeName };
  // Admins open orders in the platform order list; creators open their own order page
  const orderHref = (id: string, number: string) => (scope === "creator" || primary ? `/orders/${id}` : `/admin/orders?q=${encodeURIComponent(number)}`);
  const out: Indexed[] = [];

  out.push({ ...base, type: "store", id: slug, title: storeName, subtitle: `powerproof.store/${slug} · ${sc.store.ownerName}`, href: `/s/${slug}`, date: sc.store.createdAt, text: text(storeName, slug, sc.store.ownerName, sc.store.tagline), rawEmails: [sc.store.ownerEmail.toLowerCase()], rawPhones: [], actions: scope === "admin" ? ["open", "copy", "suspend_store"] : ["open", "copy"] });

  for (const p of sc.products) {
    out.push({ ...base, type: "product", id: p.id, title: p.title, subtitle: `${p.sku} · ${p.kind}`, status: p.status, amount: p.price, date: p.createdAt, href: primary && scope === "creator" ? `/products/${p.id}` : `/s/${slug}/${p.slug}`, text: text(p.title, p.sku, p.slug, p.kind, p.id), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
  }

  for (const o of sc.orders) {
    const refundable = o.status === "paid" || o.status === "refund_requested";
    out.push({
      ...base,
      ...contact(scope, o.buyerEmail || undefined, o.buyerPhone),
      type: "order",
      id: o.id,
      number: o.number,
      title: o.number,
      subtitle: `${o.buyerName || "Checkout started"} · ${o.productTitle}`,
      status: o.status,
      amount: o.buyerTotal,
      date: o.createdAt,
      href: orderHref(o.id, o.number),
      text: text(o.number, o.buyerName, o.productTitle, o.id, o.couponCode),
      actions: refundable ? ["open", "copy", "refund"] : ["open", "copy"],
    });
    if (o.invoiceNumber) {
      out.push({ ...base, type: "invoice", id: o.id, title: o.invoiceNumber, subtitle: `${o.number} · ${o.buyerName}`, status: o.status, amount: o.buyerTotal, date: o.paidAt ?? o.createdAt, href: `/invoice/${o.id}`, text: text(o.invoiceNumber, o.number, o.buyerName), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
    }
    if (o.status === "refund_requested" || o.status === "refunded") {
      out.push({ ...base, ...contact(scope, o.buyerEmail || undefined), type: "dispute", id: `rf_${o.id}`, number: o.number, title: `Refund · ${o.number}`, subtitle: o.refundReason ?? o.productTitle, status: o.status, amount: o.buyerTotal, date: o.refundedAt ?? o.createdAt, href: orderHref(o.id, o.number), text: text("refund", o.number, o.buyerName, o.refundReason), actions: o.status === "refund_requested" ? ["open", "copy", "refund"] : ["open", "copy"] });
    }
  }

  for (const c of sc.customers) {
    const phone = sc.orders.find((o) => o.customerId === c.id && o.buyerPhone)?.buyerPhone;
    out.push({ ...base, ...contact(scope, c.email, phone), type: "buyer", id: c.id, title: c.name, subtitle: `${c.ordersCount} order${c.ordersCount === 1 ? "" : "s"} · ${c.country}`, amount: c.totalSpent, date: c.lastOrderAt, href: primary && scope === "creator" ? `/customers/${c.id}` : primary ? `/customers/${c.id}` : `/admin/orders?q=${encodeURIComponent(c.name)}`, text: text(c.name, c.country, c.id), actions: ["open", "copy"] });
  }

  for (const r of sc.reviews) {
    out.push({ ...base, type: "review", id: r.id, title: r.title, subtitle: `${r.rating}★ · ${r.author}`, status: r.hidden ? "hidden" : r.reported ? "reported" : "shown", date: r.createdAt, href: primary && scope === "creator" ? `/store/reviews` : `/s/${slug}/${sc.products.find((p) => p.id === r.productId)?.slug ?? ""}#reviews`, text: text(r.title, r.body, r.author), rawEmails: [], rawPhones: [], actions: r.hidden ? ["open", "copy"] : ["open", "copy", "hide_review"] });
  }

  for (const q of sc.questions) {
    out.push({ ...base, ...contact(scope, q.askerEmail), type: "question", id: q.id, title: q.body.length > 80 ? `${q.body.slice(0, 80)}…` : q.body, subtitle: `${q.asker} · ${q.answers.length ? "answered" : "waiting"}`, status: q.hidden ? "hidden" : q.answers.length ? "answered" : "open", date: q.createdAt, href: primary && scope === "creator" ? `/store/questions` : `/s/${slug}/${sc.products.find((p) => p.id === q.productId)?.slug ?? ""}#questions`, text: text(q.body, q.asker), actions: ["open", "copy"] });
  }

  for (const c of sc.coupons) {
    out.push({ ...base, type: "coupon", id: c.id, title: c.code, subtitle: `${c.kind === "percent" ? `${c.value}% off` : "Fixed amount off"} · used ${c.used}${c.usageLimit ? ` of ${c.usageLimit}` : ""}`, status: c.active ? "active" : "inactive", href: primary && scope === "creator" ? `/store/offers` : `/s/${slug}`, text: text(c.code), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
  }

  return out;
}

function buildIndex(scope: SearchScope): Indexed[] {
  const d = db();
  const scopes = scope === "admin" ? allScopes() : [d];
  const items = scopes.flatMap((sc) => scopeItems(sc, scope));

  // The creator's own payouts
  for (const p of d.payouts) {
    items.push({ type: "payout", id: p.id, title: `Payout ${p.reference ?? p.id}`, subtitle: p.methodLabel, status: p.status, amount: p.amount, date: p.createdAt, storeSlug: d.store.slug, storeName: d.store.name, href: scope === "creator" ? `/payouts` : `/admin/payouts`, text: text("payout", p.reference, p.methodLabel, p.id), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
  }

  if (scope === "admin") {
    const a = adminDb();
    const known = new Set(items.filter((i) => i.type === "store").map((i) => i.storeSlug));
    for (const c of a.creators) {
      items.push({ ...contact(scope, c.email), type: "creator", id: c.id, title: c.ownerName, subtitle: `${c.storeName} · ${c.city}`, status: c.plan, amount: c.gmv30d, date: c.joinedAt, storeSlug: c.slug, storeName: c.storeName, href: `/admin/creators?q=${encodeURIComponent(c.storeName)}`, text: text(c.ownerName, c.storeName, c.slug, c.city), actions: c.plan === "suspended" ? ["open", "copy"] : ["open", "copy", "suspend_store"] });
      if (!known.has(c.slug)) {
        items.push({ type: "store", id: c.slug, title: c.storeName, subtitle: `powerproof.store/${c.slug} · ${c.ownerName}`, status: c.plan, storeSlug: c.slug, storeName: c.storeName, date: c.joinedAt, href: `/admin/creators?q=${encodeURIComponent(c.storeName)}`, text: text(c.storeName, c.slug, c.ownerName), rawEmails: [c.email], rawPhones: [], actions: c.plan === "suspended" ? ["open", "copy"] : ["open", "copy", "suspend_store"] });
      }
    }
    const slugOf = (name: string) => a.creators.find((c) => c.storeName === name)?.slug;
    for (const dp of a.disputes) {
      items.push({ ...contact(scope, dp.buyerEmail), type: "dispute", id: dp.id, number: dp.orderNumber, title: `Dispute · ${dp.orderNumber}`, subtitle: `${dp.reason.replace(/_/g, " ")} · ${dp.storeName}`, status: dp.status, amount: dp.amount, date: dp.openedAt, storeSlug: slugOf(dp.storeName), storeName: dp.storeName, href: `/admin/disputes`, text: text("dispute", dp.orderNumber, dp.storeName, dp.reason.replace(/_/g, " ")), actions: ["open", "copy"] });
    }
    for (const p of a.payouts) {
      items.push({ type: "payout", id: p.id, title: `Payout to ${p.storeName}`, subtitle: p.method + (p.note ? ` · ${p.note}` : ""), status: p.status, amount: p.amount, date: p.requestedAt, storeSlug: slugOf(p.storeName), storeName: p.storeName, href: `/admin/payouts`, text: text("payout", p.storeName, p.method, p.note, p.id), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
    }
    for (const f of a.flags) {
      items.push({ type: "flag", id: f.id, title: f.target, subtitle: `${f.kind} · ${f.reason}`, status: f.status, date: f.createdAt, storeSlug: slugOf(f.storeName), storeName: f.storeName, href: `/admin/flags`, text: text(f.target, f.reason, f.storeName, f.kind), rawEmails: [], rawPhones: [], actions: ["open", "copy"] });
    }
  }
  return items;
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

export function search(query: string, opts: { scope?: SearchScope; filters?: SearchFilters; perGroup?: number } = {}): Promise<SearchResponse> {
  const scope = opts.scope ?? "admin";
  return call(() => {
    if (!query.trim()) return { query, pattern: "text", groups: [], total: 0 } satisfies SearchResponse;
    const filters = scope === "creator" ? { ...opts.filters, types: (opts.filters?.types?.length ? opts.filters.types : CREATOR_TYPES).filter((t) => CREATOR_TYPES.includes(t)) } : opts.filters;
    return runSearch(buildIndex(scope), query, filters, opts.perGroup ?? 5);
  }, { fast: true });
}

/** Stores an admin can filter by */
export function searchStores(): Promise<{ slug: string; name: string }[]> {
  return call(() => {
    const seen = new Map<string, string>();
    for (const sc of allScopes()) seen.set(sc.store.slug, sc.store.name);
    for (const c of adminDb().creators) if (!seen.has(c.slug)) seen.set(c.slug, c.storeName);
    return [...seen].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, { fast: true });
}

/* ------------------------------------------------------------------ */
/* Reveal, quick actions and audit                                      */
/* ------------------------------------------------------------------ */

const ACTOR = "Founder (you)";

function log(entry: Omit<AuditEntry, "id" | "at" | "actor">) {
  commit((d) => {
    d.audit = [{ id: uid("au"), at: new Date().toISOString(), actor: ACTOR, ...entry }, ...(d.audit ?? [])].slice(0, 500);
  });
}

function findItem(type: SearchType, id: string): Indexed {
  return buildIndex("admin").find((i) => i.type === type && i.id === id) ?? notFound("Record");
}

/** Shows a masked email or phone in full and writes who saw it, and why, to the audit log. */
export function revealContact(type: SearchType, id: string, field: "email" | "phone", reason?: string): Promise<string> {
  return call(() => {
    const item = findItem(type, id);
    const value = field === "email" ? item.rawEmails[0] : item.phone && findRawPhone(type, id);
    if (!value) throw new ApiError(`No ${field} on this record.`, "not_found");
    log({ action: field === "email" ? "reveal_email" : "reveal_phone", targetType: type, targetId: id, targetLabel: item.title, reason: reason?.trim() || undefined });
    return value;
  }, { fast: true });
}

function findRawPhone(type: SearchType, id: string): string | undefined {
  for (const sc of allScopes()) {
    if (type === "order") {
      const o = sc.orders.find((x) => x.id === id);
      if (o) return o.buyerPhone;
    }
    if (type === "buyer") {
      const c = sc.customers.find((x) => x.id === id);
      if (c) return sc.orders.find((o) => o.customerId === c.id && o.buyerPhone)?.buyerPhone;
    }
  }
  return undefined;
}

/** Destructive quick actions from search. Each one is confirmed in the UI and logged here. */
export function runQuickAction(action: Exclude<QuickAction, "open" | "copy">, type: SearchType, id: string, reason?: string): Promise<void> {
  return call(() => {
    const item = findItem(type, id);
    if (!item.actions.includes(action)) throw new ApiError("That action isn't available for this record.", "conflict");
    if (action === "refund") {
      const orderId = type === "dispute" ? id.replace(/^rf_/, "") : id;
      commit(() => {
        for (const sc of allScopes()) {
          const o = sc.orders.find((x) => x.id === orderId);
          if (!o) continue;
          o.status = "refunded";
          o.refundedAt = new Date().toISOString();
          o.refundReason = reason?.trim() || o.refundReason || "Refunded by PowerProof support";
        }
      });
    } else if (action === "hide_review") {
      commit(() => {
        for (const sc of allScopes()) {
          const r = sc.reviews.find((x) => x.id === id);
          if (r) r.hidden = true;
        }
      });
    } else if (action === "suspend_store") {
      const slug = item.storeSlug ?? id;
      const c = adminDb().creators.find((x) => x.slug === slug);
      if (c) c.plan = "suspended";
    }
    log({ action, targetType: type, targetId: id, targetLabel: item.title, reason: reason?.trim() || undefined });
  });
}

export function getAuditLog(): Promise<AuditEntry[]> {
  return call(() => db().audit ?? []);
}
