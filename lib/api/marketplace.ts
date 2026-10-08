import type { Rates } from "../fx";
import { sb } from "../supabase/browser";
import type { CurrencyCode, Money, ProductKind } from "../types";
import { ApiError } from "./client";
import { fail, must } from "./live/errors";
import { liveChange } from "./live/notify";
import { currency } from "./live/map";
import { activeStoreId } from "./live/session";
import { updateProduct } from "./products";

/**
 * The marketplace: deals that creators list from their own live products. A deal is a one-time
 * purchase or a subscription, with the original price and the deal price. Buyers read them through
 * one database function that works out the trust badges from real orders and shows revenue only
 * when the creator chose to. Creators manage their own deals here too.
 */
export type Billing = "one_time" | "subscription";
export type Interval = "month" | "year";

/** A deal as a buyer sees it */
export interface Deal {
  id: string;
  title: string;
  pitch: string;
  billing: Billing;
  interval?: Interval;
  original: Money;
  price: Money;
  percentOff: number;
  productSlug: string;
  storeName: string;
  storeSlug: string;
  /** Where the seller is based (ISO code) */
  country: string;
  fulfilment: "digital" | "physical";
  kind: string;
  cover?: string;
  coverBg?: string;
  /** Checked by PowerProof staff */
  verified: boolean;
  /** Earned: enough paid orders, few refunds, good reviews */
  trusted: boolean;
  sold: number;
  /** Lifetime and last 30 days. Missing when the creator keeps it private. */
  revenue?: Money;
  revenue30?: Money;
  rating?: number;
  reviews: number;
  endsAt?: string;
  createdAt: string;
}

export type SortKey = "sold" | "revenue" | "discount" | "newest" | "ending";

export interface MarketFilters {
  search?: string;
  fulfilment?: "digital" | "physical";
  billing?: Billing;
  kind?: ProductKind;
  /** The seller's country (ISO code) */
  country?: string;
  /** Major units, in whatever currency the deals are in */
  min?: number;
  max?: number;
  badge?: "verified" | "trusted";
  sort?: SortKey;
  limit?: number;
}

const off = (price: number, original: number) => (original > price ? Math.round((1 - price / original) * 100) : 0);

export async function getMarketplace(f: MarketFilters = {}): Promise<Deal[]> {
  const r = await sb().rpc("marketplace_deals", {
    p_search: f.search?.trim() || (undefined as unknown as string),
    p_fulfilment: f.fulfilment as string,
    p_billing: f.billing as string,
    p_kind: f.kind as string,
    p_min_minor: f.min != null ? Math.round(f.min * 100) : (undefined as unknown as number),
    p_max_minor: f.max != null ? Math.round(f.max * 100) : (undefined as unknown as number),
    p_badge: f.badge as string,
    p_sort: f.sort ?? "sold",
    p_limit: f.limit ?? 48,
    p_country: f.country as string,
  });
  if (r.error) throw new ApiError("We couldn't load the marketplace. Please try again.");
  return (r.data ?? []).map((d) => {
    const cur: CurrencyCode = currency(d.currency);
    const m = (n: number | null): Money | undefined => (n == null ? undefined : { amount: Number(n), currency: cur });
    return {
      id: d.deal_id,
      title: d.title,
      pitch: d.pitch,
      billing: d.billing === "subscription" ? "subscription" : "one_time",
      interval: d.billing_interval === "year" ? "year" : d.billing_interval === "month" ? "month" : undefined,
      original: m(d.original_minor)!,
      price: m(d.price_minor)!,
      percentOff: off(Number(d.price_minor), Number(d.original_minor)),
      productSlug: d.product_slug,
      storeName: d.store_name,
      storeSlug: d.store_slug,
      country: d.store_country ?? "IN",
      fulfilment: d.fulfilment === "physical" ? "physical" : "digital",
      kind: d.kind,
      cover: d.cover_url ?? undefined,
      coverBg: d.cover_bg ?? undefined,
      verified: d.verified,
      trusted: d.trusted,
      sold: Number(d.units),
      revenue: m(d.revenue_minor),
      revenue30: m(d.revenue_30d_minor),
      rating: d.rating != null && Number(d.reviews) > 0 ? Number(d.rating) : undefined,
      reviews: Number(d.reviews),
      endsAt: d.ends_at ?? undefined,
      createdAt: d.created_at,
    };
  });
}

/* Creator ------------------------------------------------------------ */

export interface MyDeal {
  id: string;
  productId: string;
  title: string;
  pitch: string;
  billing: Billing;
  interval?: Interval;
  original: Money;
  price: Money;
  endsAt?: string;
  showRevenue: boolean;
  status: "live" | "paused";
  verified: boolean;
  createdAt: string;
}

export type DealInput = Omit<MyDeal, "id" | "verified" | "createdAt">;

const COLS = "id, product_id, title, pitch, billing, billing_interval, original_price_minor, price_minor, ends_at, show_revenue, status, verified_at, created_at";

type Row = { id: string; product_id: string; title: string; pitch: string; billing: string; billing_interval: string | null; original_price_minor: number; price_minor: number; ends_at: string | null; show_revenue: boolean; status: string; verified_at: string | null; created_at: string };

function mine(r: Row, cur: CurrencyCode): MyDeal {
  return {
    id: r.id,
    productId: r.product_id,
    title: r.title,
    pitch: r.pitch,
    billing: r.billing === "subscription" ? "subscription" : "one_time",
    interval: r.billing_interval === "year" ? "year" : r.billing_interval === "month" ? "month" : undefined,
    original: { amount: Number(r.original_price_minor), currency: cur },
    price: { amount: Number(r.price_minor), currency: cur },
    endsAt: r.ends_at ?? undefined,
    showRevenue: r.show_revenue,
    status: r.status === "paused" ? "paused" : "live",
    verified: !!r.verified_at,
    createdAt: r.created_at,
  };
}

async function storeCurrency(storeId: string): Promise<CurrencyCode> {
  const { data } = await sb().from("stores").select("currency_base").eq("id", storeId).single();
  return currency(data?.currency_base);
}

export async function getMyDeals(): Promise<MyDeal[]> {
  const storeId = await activeStoreId();
  const cur = await storeCurrency(storeId);
  const rows = must(await sb().from("marketplace_deals").select(COLS).eq("store_id", storeId).order("created_at", { ascending: false }));
  return (rows as Row[]).map((r) => mine(r, cur));
}

export async function getMyDeal(id: string): Promise<MyDeal> {
  const storeId = await activeStoreId();
  const row = must(await sb().from("marketplace_deals").select(COLS).eq("id", id).eq("store_id", storeId).single(), { notFound: "Deal" }) as Row;
  return mine(row, await storeCurrency(storeId));
}

function check(d: DealInput) {
  if (d.title.trim().length < 3) throw new ApiError("Give the deal a name of at least 3 characters.", "validation");
  if (d.pitch.trim().length < 20) throw new ApiError("Say a bit more about the deal: at least a sentence.", "validation");
  if (d.price.amount <= 0) throw new ApiError("Set the deal price.", "validation");
  if (d.original.amount <= d.price.amount) throw new ApiError("The original price should be higher than your price.", "validation");
  if (d.billing === "subscription" && !d.interval) throw new ApiError("Say how often a subscription is charged.", "validation");
  if (d.endsAt && Date.parse(d.endsAt) < Date.now()) throw new ApiError("The end date has passed.", "validation");
}

const rowOf = (d: DealInput) => ({
  title: d.title.trim(),
  pitch: d.pitch.trim(),
  billing: d.billing,
  billing_interval: d.billing === "subscription" ? d.interval ?? "month" : null,
  original_price_minor: d.original.amount,
  price_minor: d.price.amount,
  ends_at: d.endsAt ?? null,
  show_revenue: d.showRevenue,
  status: d.status,
});

/**
 * Buyers pay the product's price, so a deal sets the product to its price and crossed-out price:
 * what the marketplace shows is what checkout charges.
 */
async function syncProduct(d: DealInput) {
  await updateProduct(d.productId, { price: d.price, compareAt: d.original });
}

export function createDeal(d: DealInput): Promise<MyDeal> {
  return liveChange(
    (async () => {
      check(d);
      const storeId = await activeStoreId();
      const r = await sb().from("marketplace_deals").insert({ store_id: storeId, product_id: d.productId, ...rowOf(d) }).select(COLS).single();
      if (r.error) fail(r.error, { conflict: "That product already has a deal. Edit it instead." });
      await syncProduct(d);
      return mine(r.data as Row, await storeCurrency(storeId));
    })()
  );
}

export function updateDeal(id: string, d: DealInput): Promise<MyDeal> {
  return liveChange(
    (async () => {
      check(d);
      const storeId = await activeStoreId();
      const r = await sb().from("marketplace_deals").update({ ...rowOf(d), updated_at: new Date().toISOString() }).eq("id", id).select(COLS).single();
      if (r.error) fail(r.error, { notFound: "Deal" });
      await syncProduct(d);
      return mine(r.data as Row, await storeCurrency(storeId));
    })()
  );
}

export const deleteDeal = (id: string): Promise<void> =>
  liveChange(
    (async () => {
      const r = await sb().from("marketplace_deals").delete().eq("id", id);
      if (r.error) fail(r.error);
    })()
  );

/** Staff only: mark a deal as checked, or take the mark off */
export const verifyDeal = (id: string, on: boolean): Promise<void> =>
  liveChange(
    (async () => {
      const r = await sb().rpc("admin_verify_deal", { p_deal: id, p_on: on });
      if (r.error) throw new ApiError("Only staff can verify deals.", "validation");
    })()
  );

/** Rates for showing prices in the viewer's own currency (empty until rates are loaded) */
export async function getRates(): Promise<Rates> {
  const r = await sb().from("fx_rates").select("currency, per_usd");
  const rates: Rates = {};
  for (const x of r.data ?? []) rates[currency(x.currency)] = Number(x.per_usd);
  return rates;
}
