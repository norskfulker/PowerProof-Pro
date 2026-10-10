import { sb } from "../supabase/browser";
import type { CurrencyCode, Money } from "../types";
import { ApiError } from "./client";
import { currency } from "./live/map";
import { liveChange } from "./live/notify";

/**
 * The founder console. Every call is a database function that checks the signed-in user is an
 * admin before it reads or changes anything, and every change leaves a row in the audit log.
 * Nothing here is reachable by a creator: the functions refuse them.
 */

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

const MESSAGES: [string, string][] = [
  ["not_admin", "Only PowerProof staff can do that."],
  ["reason_required", "Add a reason of at least a few words."],
  ["reference_required", "Enter the bank or UTR reference for this payout."],
  ["payout_closed", "That payout is already finished."],
  ["payout_action_invalid", "That isn't something a payout can do."],
  ["store_not_found", "That store no longer exists."],
  ["not_found", "That item no longer exists."],
  ["reason required", "Add a reason of at least a few words."],
];

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await (sb() as unknown as { rpc: Rpc }).rpc(fn, args);
  if (r.error) {
    console.error(`[admin] ${fn}: ${r.error.message}`);
    const hit = MESSAGES.find(([k]) => r.error!.message.includes(k));
    throw new ApiError(hit ? hit[1] : "We couldn't reach PowerProof. Check your connection and try again.", hit ? "validation" : undefined);
  }
  return r.data as T;
}

const money = (amount: number, cur: string): Money => ({ amount: Number(amount), currency: currency(cur) });

/** Amounts per currency (money from different countries is never added together) */
export interface CurrencyTotal {
  currency: CurrencyCode;
  amount: number;
}
const totals = (rows: { currency: string; amount: number }[] | null | undefined): CurrencyTotal[] => (rows ?? []).map((x) => ({ currency: currency(x.currency), amount: Number(x.amount) }));

/* Overview ------------------------------------------------------------------------------------ */

export type Range = 3 | 7 | 30;
export const RANGES: Range[] = [3, 7, 30];

export interface Cohort {
  dau: number;
  mau: number;
  yau: number;
}

export interface AdminOverview {
  days: number;
  totals: {
    creators: number;
    pro: number;
    stores: number;
    storesLive: number;
    storesSuspended: number;
    products: number;
    productsLive: number;
    paidOrders: number;
    buyers: number;
    refunded: number;
    gmv: CurrencyTotal[];
    fees: CurrencyTotal[];
  };
  /** The chosen range, and the same length just before it for comparing */
  period: { payments: number; refunds: number; signups: number; newStores: number; buyers: number; activeCreators: number; visitors: number; gmv: CurrencyTotal[]; fees: CurrencyTotal[] };
  before: { payments: number; signups: number; activeCreators: number; visitors: number };
  /** Daily, monthly and yearly active: creators (who opened the app), storefront visitors (browser sessions) and buyers (who paid) */
  activity: { creators: Cohort; visitors: Cohort; buyers: Cohort };
  live: { creators: number; visitors: number; payments: number };
  queues: { payouts: number; disputes: number; reports: number; deals: number; webhookFailures: number };
  series: { day: string; payments: number; signups: number; activeCreators: number; visitors: number }[];
}

export async function getAdminOverview(days: Range = 30): Promise<AdminOverview> {
  const o = await call<AdminOverview & { totals: { gmv: { currency: string; amount: number }[]; fees: { currency: string; amount: number }[] }; period: { gmv: { currency: string; amount: number }[]; fees: { currency: string; amount: number }[] } }>("admin_overview", { p_days: days });
  return { ...o, totals: { ...o.totals, gmv: totals(o.totals.gmv), fees: totals(o.totals.fees) }, period: { ...o.period, gmv: totals(o.period.gmv), fees: totals(o.period.fees) }, series: o.series ?? [] };
}

/** Who is here right now (the last five minutes). Cheap enough to ask every few seconds. */
export const getAdminLive = (): Promise<{ creators: number; visitors: number; payments: number; at: string }> => call("admin_live");

/** Counts for the console's menu badges */
export async function getAdminCounts(): Promise<{ disputes_open: number; reports_open: number; payouts_open: number }> {
  return call("admin_counts");
}

/* Creators and stores -------------------------------------------------------------------------- */

export interface AdminCreator {
  id: string;
  email: string;
  name: string;
  plan: "free" | "pro";
  country: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  stores: number;
  suspended: number;
  orders: number;
  revenue: CurrencyTotal[];
}

export async function getAdminCreators(): Promise<AdminCreator[]> {
  const rows = await call<{ id: string; email: string; full_name: string | null; plan: string; country: string | null; created_at: string; last_seen_at: string | null; stores: number; suspended: number; orders: number; revenue: { currency: string; amount: number }[] }[]>("admin_creators");
  return (rows ?? []).map((r) => ({ id: r.id, email: r.email, name: r.full_name ?? "", plan: r.plan === "pro" ? "pro" : "free", country: r.country, createdAt: r.created_at, lastSeenAt: r.last_seen_at, stores: Number(r.stores), suspended: Number(r.suspended), orders: Number(r.orders), revenue: totals(r.revenue) }));
}

export interface AdminStore {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "published" | "suspended";
  ownerEmail: string;
  ownerName: string;
  currency: CurrencyCode;
  country: string | null;
  createdAt: string;
  products: number;
  orders: number;
  gross: Money;
  domain: string | null;
}

export async function getAdminStores(): Promise<AdminStore[]> {
  const rows = await call<{ id: string; slug: string; name: string; status: AdminStore["status"]; owner_email: string | null; owner_name: string | null; currency: string; country: string | null; created_at: string; products: number; orders: number; gross: number; domain: string | null }[]>("admin_stores");
  return (rows ?? []).map((r) => ({ id: r.id, slug: r.slug, name: r.name, status: r.status, ownerEmail: r.owner_email ?? "", ownerName: r.owner_name ?? "", currency: currency(r.currency), country: r.country, createdAt: r.created_at, products: Number(r.products), orders: Number(r.orders), gross: money(r.gross, r.currency), domain: r.domain }));
}

/** Suspending takes the store off the internet and stops new orders. Lifting it returns the store to what it was. */
export const setStoreSuspended = (storeId: string, suspend: boolean, reason?: string): Promise<string> =>
  liveChange(call<string>("admin_set_store_status", { p_store: storeId, p_suspend: suspend, p_reason: reason ?? null }));

/* Orders, refunds, disputes -------------------------------------------------------------------- */

export interface AdminOrder {
  id: string;
  number: string;
  storeId: string;
  storeName: string;
  status: "pending" | "paid" | "failed" | "refunded";
  buyerName: string;
  /** Hidden in the middle: reveal a phone number or read the order for more */
  buyerEmail: string;
  country: string | null;
  total: Money;
  createdAt: string;
  paidAt: string | null;
  disputed: boolean;
}

export async function getAdminOrders(): Promise<AdminOrder[]> {
  const rows = await call<{ id: string; ref: string; store_id: string; store_name: string; status: AdminOrder["status"]; buyer_name: string; buyer_email: string; country: string | null; currency: string; total_minor: number; paid_at: string | null; created_at: string; disputed: boolean }[]>("admin_orders");
  return (rows ?? []).map((r) => ({ id: r.id, number: r.ref, storeId: r.store_id, storeName: r.store_name, status: r.status, buyerName: r.buyer_name, buyerEmail: r.buyer_email, country: r.country, total: money(r.total_minor, r.currency), createdAt: r.created_at, paidAt: r.paid_at, disputed: r.disputed }));
}

/** Staff refund any paid order: the money goes back to the buyer's original payment method and the refund is written to the audit log */
export const adminRefundOrder = (orderId: string, reason: string): Promise<void> =>
  liveChange(
    (async () => {
      const res = await fetch(`/api/orders/${orderId}/refund`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
      const out = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; message?: string };
      if (!out.ok) throw new ApiError(out.message ?? "The refund didn't go through.", res.status === 404 ? "not_found" : "validation");
    })()
  );

/** A buyer's phone number is private: this needs a reason, and the reason is written to the audit log */
export const revealBuyerPhone = (orderId: string, reason: string): Promise<string> => call<string>("admin_reveal_buyer_phone", { p_order: orderId, p_reason: reason });

export interface AdminRefund {
  id: string;
  createdAt: string;
  orderId: string;
  orderNumber: string;
  storeName: string;
  amount: Money;
  reason: string;
  status: string;
}

export async function getAdminRefunds(): Promise<AdminRefund[]> {
  const rows = await call<{ id: string; created_at: string; order_id: string; order_ref: string; store_name: string; amount_minor: number; currency: string; reason: string | null; status: string }[]>("admin_refunds");
  return (rows ?? []).map((r) => ({ id: r.id, createdAt: r.created_at, orderId: r.order_id, orderNumber: r.order_ref, storeName: r.store_name, amount: money(r.amount_minor, r.currency), reason: r.reason ?? "", status: r.status }));
}

export interface AdminDispute {
  id: string;
  createdAt: string;
  orderId: string;
  orderNumber: string;
  storeName: string;
  amount: Money;
  reason: string;
  status: "open" | "under_review" | "won" | "lost" | "closed";
  respondBy: string | null;
  gatewayId: string;
}

export async function getAdminDisputes(): Promise<AdminDispute[]> {
  const rows = await call<{ id: string; created_at: string; order_id: string; order_ref: string; store_name: string; amount_minor: number; currency: string; reason: string | null; status: AdminDispute["status"]; respond_by: string | null; gateway_dispute_id: string }[]>("admin_disputes");
  return (rows ?? []).map((r) => ({ id: r.id, createdAt: r.created_at, orderId: r.order_id, orderNumber: r.order_ref, storeName: r.store_name, amount: money(r.amount_minor, r.currency), reason: r.reason ?? "", status: r.status, respondBy: r.respond_by, gatewayId: r.gateway_dispute_id }));
}

/* Payouts -------------------------------------------------------------------------------------- */

export interface AdminPayout {
  id: string;
  storeName: string;
  storeCountry: string | null;
  /** The account is registered with Razorpay, so it can be paid automatically */
  hasFundAccount: boolean;
  /** What was actually sent, once it has been (converted into the seller's currency) */
  sent?: Money & { rate: number | null };
  ownerEmail: string;
  holder: string;
  method: string;
  methodKind: string;
  amount: Money;
  fee: Money;
  status: "requested" | "processing" | "paid" | "failed" | "cancelled";
  failureReason: string;
  reference: string;
  requestedAt: string;
  processedAt: string | null;
}

export async function getAdminPayouts(): Promise<AdminPayout[]> {
  const rows = await call<{ id: string; store_name: string; store_country: string | null; has_fund_account: boolean; payout_currency: string | null; payout_amount_minor: number | null; fx_rate: number | null; owner_email: string | null; holder_name: string | null; method_kind: string | null; method_label: string | null; currency: string; amount_minor: number; fee_minor: number; status: AdminPayout["status"]; failure_reason: string | null; gateway_payout_id: string | null; requested_at: string; processed_at: string | null }[]>("admin_payouts");
  return (rows ?? []).map((r) => ({ id: r.id, storeName: r.store_name, storeCountry: r.store_country, hasFundAccount: r.has_fund_account, sent: r.payout_currency && r.payout_amount_minor != null ? { ...money(r.payout_amount_minor, r.payout_currency), rate: r.fx_rate == null ? null : Number(r.fx_rate) } : undefined, ownerEmail: r.owner_email ?? "", holder: r.holder_name ?? "", method: r.method_label ?? "Removed method", methodKind: r.method_kind ?? "", amount: money(r.amount_minor, r.currency), fee: money(r.fee_minor, r.currency), status: r.status, failureReason: r.failure_reason ?? "", reference: r.gateway_payout_id ?? "", requestedAt: r.requested_at, processedAt: r.processed_at }));
}

/** Payouts are sent by hand until a payout provider is connected. Mark one on its way, paid (with the bank reference), or failed (the money returns to the seller's balance). */
export const setPayoutState = (id: string, action: "processing" | "paid" | "failed", detail: { reference?: string; reason?: string } = {}): Promise<void> =>
  liveChange(call<void>("admin_set_payout", { p_payout: id, p_action: action, p_ref: detail.reference ?? null, p_reason: detail.reason ?? null }));

/* Moderation ----------------------------------------------------------------------------------- */

export interface AdminContent {
  id: string;
  kind: "review" | "question";
  createdAt: string;
  hidden: boolean;
  storeName: string;
  productTitle: string;
  author: string;
  rating: number | null;
  title: string;
  body: string;
  reply: string;
  openReports: number;
}

export async function getAdminContent(kind: "review" | "question"): Promise<AdminContent[]> {
  const rows = await call<{ id: string; kind: "review" | "question"; created_at: string; status: string; store_name: string; product_title: string | null; author: string; rating: number | null; title: string | null; body: string | null; answer: string | null; open_reports: number }[]>("admin_content", { p_type: kind });
  return (rows ?? []).map((r) => ({ id: r.id, kind: r.kind, createdAt: r.created_at, hidden: r.status === "hidden", storeName: r.store_name, productTitle: r.product_title ?? "", author: r.author, rating: r.rating, title: r.title ?? "", body: r.body ?? "", reply: r.answer ?? "", openReports: Number(r.open_reports) }));
}

export const moderateContent = (kind: "review" | "question", id: string, hide: boolean, reason?: string): Promise<void> =>
  liveChange(call<void>("admin_moderate", { p_type: kind, p_id: id, p_hide: hide, p_reason: reason ?? null }));

export interface AdminReport {
  id: string;
  createdAt: string;
  targetType: "review" | "question" | "product" | "store";
  label: string;
  storeName: string;
  excerpt: string;
  reason: string;
  reporter: string;
  status: "open" | "actioned" | "dismissed";
}

export async function getAdminReports(): Promise<AdminReport[]> {
  const rows = await call<{ id: string; created_at: string; target_type: AdminReport["targetType"]; label: string; store_name: string | null; excerpt: string | null; reason: string; reporter_email: string | null; status: AdminReport["status"] }[]>("admin_reports");
  return (rows ?? []).map((r) => ({ id: r.id, createdAt: r.created_at, targetType: r.target_type, label: r.label, storeName: r.store_name ?? "", excerpt: r.excerpt ?? "(removed)", reason: r.reason, reporter: r.reporter_email ?? "", status: r.status }));
}

/** Take the reported thing down (a review or question is hidden, a product archived, a store suspended), or dismiss the report */
export const resolveReport = (id: string, remove: boolean): Promise<void> => liveChange(call<void>("admin_resolve_report", { p_report: id, p_remove: remove }));

export interface AdminDeal {
  id: string;
  createdAt: string;
  title: string;
  storeName: string;
  billing: "one_time" | "subscription";
  price: Money;
  original: Money;
  status: "live" | "paused";
  verified: boolean;
  endsAt: string | null;
}

export async function getAdminDeals(): Promise<AdminDeal[]> {
  const rows = await call<{ id: string; created_at: string; title: string; store_name: string; billing: AdminDeal["billing"]; price_minor: number; original_price_minor: number; currency: string; status: AdminDeal["status"]; verified_at: string | null; ends_at: string | null }[]>("admin_deals");
  return (rows ?? []).map((r) => ({ id: r.id, createdAt: r.created_at, title: r.title, storeName: r.store_name, billing: r.billing, price: money(r.price_minor, r.currency), original: money(r.original_price_minor, r.currency), status: r.status, verified: !!r.verified_at, endsAt: r.ends_at }));
}

/* System ---------------------------------------------------------------------------------------- */

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown>;
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  const rows = await call<{ id: number; created_at: string; actor_email: string | null; action: string; target_type: string | null; target_id: string | null; meta: Record<string, unknown> | null }[]>("admin_audit");
  return (rows ?? []).map((r) => ({ id: Number(r.id), at: r.created_at, actor: r.actor_email ?? "System", action: r.action, targetType: r.target_type ?? "", targetId: r.target_id ?? "", meta: r.meta ?? {} }));
}

export interface AdminHit {
  kind: "store" | "product" | "order" | "creator";
  id: string;
  label: string;
  sublabel: string;
}

export async function adminSearch(q: string): Promise<AdminHit[]> {
  if (q.trim().length < 2) return [];
  const rows = await call<AdminHit[]>("admin_search", { p_q: q.trim(), p_limit: 15 });
  return rows ?? [];
}

/* Products ----------------------------------------------------------------------------------------- */

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "live" | "archived";
  storeId: string;
  storeName: string;
  storeSlug: string;
  /** Whether the store itself is open: a live product in a suspended store isn't visible to buyers */
  storeStatus: "draft" | "published" | "suspended";
  fulfilment: "digital" | "physical";
  type: string;
  price: Money;
  createdAt: string;
  units: number;
  revenue: Money;
}

export async function getAdminProducts(): Promise<AdminProduct[]> {
  const rows = await call<{ id: string; title: string; slug: string; status: AdminProduct["status"]; store_id: string; store_name: string; store_slug: string; store_status: AdminProduct["storeStatus"]; fulfilment: string | null; product_type: string | null; currency: string; price_minor: number; created_at: string; units: number; revenue: number }[]>("admin_products");
  return (rows ?? []).map((r) => ({ id: r.id, title: r.title, slug: r.slug, status: r.status, storeId: r.store_id, storeName: r.store_name, storeSlug: r.store_slug, storeStatus: r.store_status, fulfilment: r.fulfilment === "physical" ? "physical" : "digital", type: r.product_type ?? "", price: money(r.price_minor, r.currency), createdAt: r.created_at, units: Number(r.units), revenue: money(r.revenue, r.currency) }));
}

/** Take a product off sale (or put it back). Anything other than putting it live needs a reason, kept in the audit log. */
export const setProductStatus = (id: string, status: "live" | "draft" | "archived", reason?: string): Promise<void> =>
  liveChange(call<void>("admin_set_product_status", { p_product: id, p_status: status, p_reason: reason ?? null }));

/* Team and webhooks ---------------------------------------------------------------------------------- */

export interface AdminPerson {
  id: string;
  email: string;
  name: string;
  since: string;
  lastSignIn: string | null;
}

/** Who has admin access. Access is given and removed in the Supabase dashboard (Authentication › Users › app metadata). */
export async function getAdminTeam(): Promise<AdminPerson[]> {
  const rows = await call<{ id: string; email: string; full_name: string | null; since: string; last_sign_in_at: string | null }[]>("admin_team");
  return (rows ?? []).map((r) => ({ id: r.id, email: r.email, name: r.full_name ?? "", since: r.since, lastSignIn: r.last_sign_in_at }));
}

export interface AdminWebhook {
  id: number;
  gateway: string;
  eventId: string;
  type: string;
  at: string;
  processedAt: string | null;
  error: string;
}

export async function getAdminWebhooks(): Promise<AdminWebhook[]> {
  const rows = await call<{ id: number; gateway: string; event_id: string; event_type: string; created_at: string; processed_at: string | null; error: string | null }[]>("admin_webhooks");
  return (rows ?? []).map((r) => ({ id: Number(r.id), gateway: r.gateway, eventId: r.event_id, type: r.event_type, at: r.created_at, processedAt: r.processed_at, error: r.error ?? "" }));
}

async function post(path: string, body?: unknown): Promise<{ ok: boolean; message?: string; [k: string]: unknown }> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const out = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; message?: string };
  if (!out.ok) throw new ApiError(out.message ?? "That didn't work. Try again.", "validation");
  return out;
}

export const retryWebhook = (id: number): Promise<void> => liveChange(post("/api/webhooks/retry", { id }).then(() => undefined));

/** Pays the seller through RazorpayX: rupees to an Indian account, converted from the store's currency if needed */
export const sendPayoutWithRazorpay = (payoutId: string): Promise<{ amount: Money; rate: number }> =>
  liveChange(post(`/api/payouts/${payoutId}/send`).then((o) => ({ amount: money(Number(o.amount), String(o.currency)), rate: Number(o.rate) })));
