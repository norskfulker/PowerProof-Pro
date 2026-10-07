import type { Client } from "./supabase";
import { serviceClient, signInAs } from "./supabase";
import { templateById } from "../../../lib/pages/templates";
import type { Manifest } from "./manifest";

/**
 * Test data, created against the real database through creator A's own session (so row level
 * security applies exactly as in the app) and removed again by `teardown`. Everything it makes is
 * marked "e2e" in its name, slug or code, so a crashed run's leftovers are swept on the next run.
 * Creator B is never given data: the empty-state tests rely on that.
 */

const MARK = "e2e";

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error || data === null) throw new Error(`E2E setup: ${what}: ${error?.message ?? "no data"}`);
  return data as NonNullable<T>;
}

async function sweep(a: Client, svc: Client | null, storeId: string) {
  // Anything marked e2e from an earlier run, oldest dependencies first
  if (svc) {
    const orders = await svc.from("orders").select("id").eq("store_id", storeId).like("buyer_email", `${MARK}-%`);
    const ids = (orders.data ?? []).map((o) => o.id);
    if (ids.length) {
      await svc.from("reviews").delete().in("order_id", ids);
      await svc.from("orders").delete().in("id", ids);
    }
  }
  await a.from("custom_pages").delete().eq("store_id", storeId).like("slug", `${MARK}-%`);
  await a.from("deal_rules").delete().eq("store_id", storeId).like("name", `${MARK} %`);
  await a.from("coupons").delete().eq("store_id", storeId).like("code", `${MARK.toUpperCase()}%`);
  const cols = await a.from("collections").select("id").eq("store_id", storeId).like("slug", `${MARK}-%`);
  for (const c of cols.data ?? []) {
    await a.from("collection_items").delete().eq("collection_id", c.id);
    await a.from("collections").delete().eq("id", c.id);
  }
  const prods = await a.from("products").select("id").eq("store_id", storeId).like("slug", `${MARK}-%`);
  for (const p of prods.data ?? []) await a.from("products").delete().eq("id", p.id);
}

export async function seed(tag: string): Promise<Manifest> {
  const svc = serviceClient();
  const { client: a, userId: aId } = await signInAs("A");
  const { client: b, userId: bId } = await signInAs("B");

  // Each creator needs a store; the app makes one at first sign-in, so do the same here
  async function storeOf(c: Client, uid: string, name: string) {
    const found = await c.from("stores").select("id, slug, name, status").eq("owner_id", uid).order("created_at").limit(1);
    if (found.data?.[0]) return found.data[0];
    return must(c.from("stores").insert({ owner_id: uid, name, slug: `${MARK}-${Math.random().toString(36).slice(2, 8)}`, tagline: "A test store." }).select("id, slug, name, status").single(), "create store");
  }
  const sa = await storeOf(a, aId, "Test store A");
  const sb = await storeOf(b, bId, "Test store B");

  await sweep(a, svc, sa.id);

  // Remember what to put back
  const profile = svc ? await svc.from("profiles").select("plan").eq("id", aId).single() : null;
  const original: Manifest["original"] = { storeStatus: sa.status, plan: profile?.data?.plan ?? "free" };
  if (svc && original.plan !== "pro") await svc.from("profiles").update({ plan: "pro" }).eq("id", aId);
  // The store must be public for the buyer screens
  if (sa.status !== "published") await must(a.from("stores").update({ status: "published" }).eq("id", sa.id).select("id").single(), "publish store A");

  const productTitle = `${MARK} Planner ${tag}`;
  const productSlug = `${MARK}-planner-${tag}`;
  const product = await must(
    a
      .from("products")
      .insert({ store_id: sa.id, title: productTitle, slug: productSlug, description: "A product made by the end-to-end tests.", status: "live", price_minor: 49900, product_type: "template", sku: `E2E-${tag}`, hsn_sac: "998433", tax_rate_bps: 1800 })
      .select("id")
      .single(),
    "create product"
  );
  let secondProductId: string | undefined;
  if (svc) {
    const second = await must(
      a.from("products").insert({ store_id: sa.id, title: `${MARK} Workbook ${tag}`, slug: `${MARK}-workbook-${tag}`, description: "A second product for tests.", status: "live", price_minor: 99900, product_type: "ebook" }).select("id").single(),
      "create second product"
    );
    secondProductId = second.id;
  }

  const collectionSlug = `${MARK}-collection-${tag}`;
  const collection = await must(a.from("collections").insert({ store_id: sa.id, name: `${MARK} Collection ${tag}`, slug: collectionSlug }).select("id").single(), "create collection");
  await must(a.from("collection_items").insert({ collection_id: collection.id, product_id: product.id }).select("product_id"), "fill collection");

  const couponCode = `${MARK.toUpperCase()}${tag.toUpperCase()}`.slice(0, 24);
  const coupon = await must(a.from("coupons").insert({ store_id: sa.id, code: couponCode, kind: "percent", value: 1000 }).select("id").single(), "create coupon");

  const pageSlug = `${MARK}-page-${tag}`;
  // A published page, built from the real template so the editor and the public page both open it
  const doc = templateById("launch").build({ storeName: sa.name, ownerName: "Test Creator", slug: sa.slug, products: [{ id: product.id, title: productTitle }], collections: [], brand: "#0F3D33", accent: "#C9A24F", now: Date.now() });
  const at = new Date().toISOString();
  const layout = JSON.parse(JSON.stringify({ template: "launch", draft: doc, published: doc, publishedAt: at, seo: { title: `${MARK} page`, description: "A page made by the tests." }, versions: [{ id: "pv_e2e", at, label: "Published", doc }] }));
  const page = await must(a.from("custom_pages").insert({ store_id: sa.id, title: `${MARK} Page ${tag}`, slug: pageSlug, layout, status: "published" }).select("id").single(), "create page");

  let dealRuleId: string | undefined;
  const dealRuleName = `${MARK} rule ${tag}`;
  if (secondProductId) {
    const rule = await must(
      a.from("deal_rules").insert({ store_id: sa.id, name: dealRuleName, trigger_product_ids: [product.id, secondProductId], reward: "percent_off", percent_bps: 1500 }).select("id").single(),
      "create deal rule"
    );
    dealRuleId = rule.id;
  }

  // Creators can't make orders (only the payment webhook does), so a paid order and its review
  // need the service-role key. Without it these stay empty and the tests that need them skip.
  let orderId: string | undefined;
  let orderNumber: string | undefined;
  let reviewId: string | undefined;
  const reviewTitle = `${MARK} review ${tag}`;
  if (svc) {
    const order = await must(
      svc
        .from("orders")
        .insert({ store_id: sa.id, buyer_name: "E2E Buyer", buyer_email: `${MARK}-buyer-${tag}@test.invalid`, buyer_phone: "+910000000000", consent_at: new Date().toISOString(), currency: "INR", subtotal_minor: 49900, total_minor: 49900, status: "paid", paid_at: new Date().toISOString() })
        .select("id, ref")
        .single(),
      "create order"
    );
    orderId = order.id;
    orderNumber = order.ref;
    await must(svc.from("order_items").insert({ order_id: order.id, product_id: product.id, title: productTitle, unit_price_minor: 49900, line_total_minor: 49900 }).select("id"), "create order item");
    const review = await must(
      svc.from("reviews").insert({ store_id: sa.id, product_id: product.id, order_id: order.id, reviewer_name: "E2E Buyer", rating: 5, title: reviewTitle, body: "A review made by the end-to-end tests." }).select("id").single(),
      "create review"
    );
    reviewId = review.id;
  }

  return {
    tag,
    hasService: Boolean(svc),
    A: { userId: aId, storeId: sa.id, slug: sa.slug, storeName: sa.name, productId: product.id, productSlug, productTitle, collectionId: collection.id, collectionSlug, couponId: coupon.id, couponCode, pageId: page.id, pageSlug, orderId, orderNumber, reviewId, reviewTitle, secondProductId, dealRuleId, dealRuleName },
    B: { userId: bId, storeId: sb.id },
    original,
  };
}

/** Removes what `seed` made, and anything the tests themselves created and marked e2e. */
export async function teardown(m: Manifest) {
  const svc = serviceClient();
  const { client: a } = await signInAs("A");
  await sweep(a, svc, m.A.storeId);
  if (m.original.storeStatus !== "published") await a.from("stores").update({ status: m.original.storeStatus }).eq("id", m.A.storeId);
  if (svc && m.original.plan !== "pro") await svc.from("profiles").update({ plan: m.original.plan }).eq("id", m.A.userId);
}
