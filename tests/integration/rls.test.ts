import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Talks to the real project. The anonymous checks only read. The creator checks sign in as two
 * throwaway accounts (TEST_CREATOR_A_* / TEST_CREATOR_B_* in .env.test.local), create rows,
 * and delete them again at the end.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const A = { email: process.env.TEST_CREATOR_A_EMAIL, password: process.env.TEST_CREATOR_A_PASSWORD };
const B = { email: process.env.TEST_CREATOR_B_EMAIL, password: process.env.TEST_CREATOR_B_PASSWORD };

type Client = SupabaseClient<Database>;
const client = (): Client => createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const haveProject = Boolean(URL && ANON);
const haveCreators = haveProject && Boolean(A.email && A.password && B.email && B.password);

describe.skipIf(!haveProject)("anonymous visitor", () => {
  const anon = haveProject ? client() : (undefined as unknown as Client);

  it("sees only published stores", async () => {
    const { data, error } = await anon.from("stores").select("id, status");
    expect(error).toBeNull();
    expect((data ?? []).every((s) => s.status === "published")).toBe(true);
  });

  it("can't read private store columns (owner, GSTIN)", async () => {
    const owner = await anon.from("stores").select("owner_id").limit(1);
    const gstin = await anon.from("stores").select("gstin").limit(1);
    expect(owner.error?.code).toBe("42501");
    expect(gstin.error?.code).toBe("42501");
  });

  it("sees only live products", async () => {
    const { data, error } = await anon.from("products").select("id, status");
    expect(error).toBeNull();
    expect((data ?? []).every((p) => p.status === "live")).toBe(true);
  });

  it("can't read orders, order lines, refunds, the ledger or payouts", async () => {
    for (const t of ["orders", "order_items", "refunds", "ledger_entries", "payouts", "payout_methods"] as const) {
      const { data, error } = await anon.from(t).select("id").limit(1);
      expect(error !== null || (data ?? []).length === 0, `${t} is readable`).toBe(true);
    }
  });

  it("can't read download tokens, webhooks, the audit log or coupons", async () => {
    for (const t of ["download_tokens", "webhook_events", "audit_log", "coupons", "ai_generations"] as const) {
      const { data, error } = await anon.from(t).select("id").limit(1);
      expect(error !== null || (data ?? []).length === 0, `${t} is readable`).toBe(true);
    }
  });

  it("can't call server-only or admin functions", async () => {
    const pay = await anon.rpc("apply_payment", { p_gateway_order_id: "order_x", p_gateway_payment_id: "pay_x" });
    const settle = await anon.rpc("settle_payout", { p_payout: "00000000-0000-0000-0000-000000000000", p_ok: true });
    const search = await anon.rpc("admin_search", { p_q: "a", p_limit: 5 });
    const reveal = await anon.rpc("admin_reveal_buyer_phone", { p_order: "00000000-0000-0000-0000-000000000000", p_reason: "testing access" });
    for (const r of [pay, settle, search, reveal]) expect(r.error).not.toBeNull();
  });

  it("can't write anything", async () => {
    const store = await anon.from("stores").insert({ owner_id: "00000000-0000-0000-0000-000000000000", name: "x", slug: "anon-write-test" });
    const question = await anon.from("questions").insert({ store_id: "00000000-0000-0000-0000-000000000000", product_id: "00000000-0000-0000-0000-000000000000", asker_name: "x", asker_email: "x@test.invalid", body: "hello there" });
    expect(store.error).not.toBeNull();
    expect(question.error).not.toBeNull();
  });

  it("gets 'invalid coupon' for a made-up code", async () => {
    const { error } = await anon.rpc("validate_coupon", { p_store: "00000000-0000-0000-0000-000000000000", p_code: "NOPE", p_subtotal: 1000 });
    expect(error?.message ?? "").toMatch(/invalid coupon/i);
  });
});

describe.skipIf(!haveCreators)("two creators", () => {
  const a = haveProject ? client() : (undefined as unknown as Client);
  const b = haveProject ? client() : (undefined as unknown as Client);
  let aId = "";
  let bId = "";
  let storeA = "";
  let storeB = "";
  const created: { products: string[]; stores: string[] } = { products: [], stores: [] };

  async function firstStore(c: Client, owner: string, slug: string) {
    const { data } = await c.from("stores").select("id").eq("owner_id", owner).order("created_at").limit(1);
    if (data?.[0]) return data[0].id;
    const r = await c.from("stores").insert({ owner_id: owner, name: "QA store", slug }).select("id").single();
    expect(r.error).toBeNull();
    created.stores.push(r.data!.id);
    return r.data!.id;
  }

  beforeAll(async () => {
    const sa = await a.auth.signInWithPassword({ email: A.email!, password: A.password! });
    const sbb = await b.auth.signInWithPassword({ email: B.email!, password: B.password! });
    expect(sa.error).toBeNull();
    expect(sbb.error).toBeNull();
    aId = sa.data.user!.id;
    bId = sbb.data.user!.id;
    storeA = await firstStore(a, aId, `qa-a-${Date.now().toString(36)}`);
    storeB = await firstStore(b, bId, `qa-b-${Date.now().toString(36)}`);
  });

  afterAll(async () => {
    for (const id of created.products) await a.from("products").delete().eq("id", id);
    for (const id of created.stores) {
      await a.from("stores").delete().eq("id", id);
      await b.from("stores").delete().eq("id", id);
    }
  });

  it("a profile row exists for each account, on the Free plan unless upgraded", async () => {
    const { data } = await a.from("profiles").select("id, plan").eq("id", aId).single();
    expect(data?.id).toBe(aId);
    expect(["free", "pro"]).toContain(data?.plan);
  });

  it("can't read or change another creator's store", async () => {
    const read = await a.from("stores").select("id, gstin").eq("id", storeB);
    expect(read.data ?? []).toEqual([]);
    const write = await a.from("stores").update({ name: "hijacked" }).eq("id", storeB).select("id");
    expect(write.data ?? []).toEqual([]);
  });

  it("can't create a store for someone else", async () => {
    const r = await a.from("stores").insert({ owner_id: bId, name: "x", slug: `qa-x-${Date.now().toString(36)}` });
    expect(r.error).not.toBeNull();
  });

  it("can't add products to another creator's store", async () => {
    const r = await a.from("products").insert({ store_id: storeB, title: "x", slug: `x-${Date.now().toString(36)}` });
    expect(r.error).not.toBeNull();
  });

  it("can't read buyer phone numbers, even on their own orders", async () => {
    const r = await a.from("orders").select("buyer_phone").limit(1);
    expect(r.error?.code).toBe("42501");
  });

  it("Free plan: ten products, then the database says no", async () => {
    const { data: profile } = await a.from("profiles").select("plan").eq("id", aId).single();
    if (profile?.plan !== "free") return;
    const { count } = await a.from("products").select("id", { count: "exact", head: true }).in("store_id", [storeA]);
    for (let i = count ?? 0; i < 10; i++) {
      const r = await a.from("products").insert({ store_id: storeA, title: "QA product", slug: `qa-${i}-${Date.now().toString(36)}` }).select("id").single();
      expect(r.error).toBeNull();
      created.products.push(r.data!.id);
    }
    const extra = await a.from("products").insert({ store_id: storeA, title: "One too many", slug: `qa-extra-${Date.now().toString(36)}` });
    expect(extra.error?.message).toMatch(/plan_limit_products/);
  });

  it("Free plan: one store, then the database says no", async () => {
    const { data: profile } = await a.from("profiles").select("plan").eq("id", aId).single();
    if (profile?.plan !== "free") return;
    const r = await a.from("stores").insert({ owner_id: aId, name: "Second", slug: `qa-second-${Date.now().toString(36)}` });
    expect(r.error?.message).toMatch(/plan_limit_stores/);
  });

  it("Free plan: no custom domain", async () => {
    const { data: profile } = await a.from("profiles").select("plan").eq("id", aId).single();
    if (profile?.plan !== "free") return;
    const r = await a.from("domains").insert({ store_id: storeA, hostname: `qa-${Date.now().toString(36)}.test.invalid` });
    expect(r.error?.message).toMatch(/Pro plan/);
  });

  it("can't change their own plan", async () => {
    const r = await a.from("profiles").update({ plan: "pro" } as never).eq("id", aId).select("plan");
    expect(r.error).not.toBeNull();
  });

  it("can't withdraw more than the available balance", async () => {
    const m = await a.from("payout_methods").insert({ kind: "bank", holder_name: "QA Creator", ifsc: "HDFC0001234", account_last4: "4321" } as never).select("id").single();
    expect(m.error).toBeNull();
    const r = await a.rpc("request_payout", { p_store: storeA, p_method: m.data!.id, p_amount: 999_999_999 });
    expect(r.error?.message).toMatch(/insufficient available balance/);
    await a.from("payout_methods").delete().eq("id", m.data!.id);
  });

  it("can't use another creator's payout method or store for a payout", async () => {
    const m = await b.from("payout_methods").insert({ kind: "upi", holder_name: "QA Creator B", upi_masked: "qa••@upi" } as never).select("id").single();
    expect(m.error).toBeNull();
    const r = await a.rpc("request_payout", { p_store: storeA, p_method: m.data!.id, p_amount: 100 });
    expect(r.error).not.toBeNull();
    const r2 = await a.rpc("request_payout", { p_store: storeB, p_method: m.data!.id, p_amount: 100 });
    expect(r2.error).not.toBeNull();
    await b.from("payout_methods").delete().eq("id", m.data!.id);
  });

  it("creators can't hide reviews or questions (admin only)", async () => {
    const { data } = await a.from("reviews").select("id").eq("store_id", storeA).limit(1);
    if (!data?.[0]) return;
    const r = await a.from("reviews").update({ status: "hidden" }).eq("id", data[0].id);
    expect(r.error?.message).toMatch(/only admin/);
  });
});
