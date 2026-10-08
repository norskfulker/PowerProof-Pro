import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * SKU, HSN/SAC and GST rules in the database (migration 013), against the real project with the two
 * test creators: format checks, one SKU per product per store, and the per-store custom codes
 * (tax_codes) that only their owner can see. Everything created here is removed again.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const A = { email: process.env.TEST_CREATOR_A_EMAIL, password: process.env.TEST_CREATOR_A_PASSWORD };
const B = { email: process.env.TEST_CREATOR_B_EMAIL, password: process.env.TEST_CREATOR_B_PASSWORD };
const have = Boolean(URL && ANON && A.email && A.password && B.email && B.password);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const as = async (who: typeof A) => {
  const c = createClient<Database>(URL, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email: who.email!, password: who.password! });
  if (error || !data.user) throw new Error(error?.message ?? "no user");
  return { c, userId: data.user.id };
};

const made: { table: "tax_codes" | "products"; id: string }[] = [];
afterAll(async () => {
  if (!have) return;
  const { c } = await as(A);
  for (const m of made) await c.from(m.table).delete().eq("id", m.id);
});

describe.skipIf(!have)("tax_codes", () => {
  it("lets a creator save a code with its rate, once, and no one else see it", async () => {
    const a = await as(A);
    const b = await as(B);
    const { data: store } = await a.c.from("stores").select("id").eq("owner_id", a.userId).limit(1).single();
    const row = { store_id: store!.id, code: "998439", kind: "SAC", description: "e2e custom", rate_bps: 1200 };
    const ins = await a.c.from("tax_codes").insert(row).select("id").single();
    expect(ins.error).toBeNull();
    made.push({ table: "tax_codes", id: ins.data!.id });
    // The same code at the same rate twice is one row
    expect((await a.c.from("tax_codes").insert(row)).error?.code).toBe("23505");
    // Another creator can neither see it nor add one to this store
    expect((await b.c.from("tax_codes").select("id").eq("id", ins.data!.id)).data).toEqual([]);
    expect((await b.c.from("tax_codes").insert(row)).error?.code).toBe("42501");
    // Visitors get nothing at all
    const anon = createClient<Database>(URL, ANON, opts);
    expect((await anon.from("tax_codes").select("id")).error).not.toBeNull();
  });

  it("refuses codes and rates that can't be real", async () => {
    const a = await as(A);
    const { data: store } = await a.c.from("stores").select("id").eq("owner_id", a.userId).limit(1).single();
    const base = { store_id: store!.id, code: "998439", kind: "SAC", description: "", rate_bps: 1800 };
    for (const bad of [{ code: "99" }, { code: "99A433" }, { code: "123456789" }, { kind: "XYZ" }, { rate_bps: 5000 }, { rate_bps: -1 }]) {
      const r = await a.c.from("tax_codes").insert({ ...base, ...bad });
      expect(r.error?.code, JSON.stringify(bad)).toBe("23514");
    }
  });
});

describe.skipIf(!have || !SERVICE)("products: SKU and HSN/SAC", () => {
  it("checks the code and SKU format, and allows each SKU once per store (case-insensitive)", async () => {
    const svc = createClient<Database>(URL, SERVICE, opts);
    const a = await as(A);
    const { data: store } = await svc.from("stores").select("id").eq("owner_id", a.userId).limit(1).single();
    const p = (n: string, extra: object) => ({ store_id: store!.id, title: `e2e ${n}`, slug: `e2e-sku-${n}-${Date.now().toString(36)}`, price_minor: 49900, ...extra });
    const one = await svc.from("products").insert(p("one", { sku: "E2E-SKU-1", hsn_sac: "998433" })).select("id").single();
    expect(one.error).toBeNull();
    made.push({ table: "products", id: one.data!.id });
    expect((await svc.from("products").insert(p("dup", { sku: "e2e-sku-1" }))).error?.code).toBe("23505");
    expect((await svc.from("products").insert(p("bad-sku", { sku: "has space" }))).error?.code).toBe("23514");
    expect((await svc.from("products").insert(p("bad-hsn", { hsn_sac: "12" }))).error?.code).toBe("23514");
    // Two products with no SKU are fine
    for (const n of ["n1", "n2"]) {
      const r = await svc.from("products").insert(p(n, {})).select("id").single();
      expect(r.error).toBeNull();
      made.push({ table: "products", id: r.data!.id });
    }
  });
});
