import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Migrations 014 and 015 against the real project, as creator B (a Free account that is kept empty):
 * 3 pages on the Free plan, crypto wallets with their checks and a limit of 5, the name a bank
 * account must carry, and a store link that can't be changed. Everything created is removed again.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const B = { email: process.env.TEST_CREATOR_B_EMAIL, password: process.env.TEST_CREATOR_B_PASSWORD };
const have = Boolean(URL && ANON && B.email && B.password);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const made: { table: "custom_pages" | "payout_methods"; id: string }[] = [];
let client: ReturnType<typeof createClient<Database>>;
let userId = "";
let storeId = "";

async function setup() {
  client = createClient<Database>(URL, ANON, opts);
  const { data, error } = await client.auth.signInWithPassword({ email: B.email!, password: B.password! });
  if (error || !data.user) throw new Error(error?.message ?? "no user");
  userId = data.user.id;
  const { data: store } = await client.from("stores").select("id").eq("owner_id", userId).limit(1).single();
  storeId = store!.id;
}

afterAll(async () => {
  if (!have || !client) return;
  for (const m of made) await client.from(m.table).delete().eq("id", m.id);
});

describe.skipIf(!have)("Free plan limits and payout methods", () => {
  it("the Free plan has 10 products and 3 pages, Pro has no limit", async () => {
    await setup();
    const { data } = await client.from("plan_limits").select("plan, max_products, max_pages");
    expect(data?.find((p) => p.plan === "free")).toMatchObject({ max_products: 10, max_pages: 3 });
    expect(data?.find((p) => p.plan === "pro")).toMatchObject({ max_products: null, max_pages: null });
  });

  it("allows 3 pages on Free and refuses the 4th", async () => {
    const { data: profile } = await client.from("profiles").select("plan").eq("id", userId).single();
    if (profile?.plan !== "free") return;
    const tag = Date.now().toString(36);
    for (let i = 1; i <= 3; i++) {
      const r = await client.from("custom_pages").insert({ store_id: storeId, slug: `e2e-${tag}-${i}`, title: `e2e ${i}`, layout: {} }).select("id").single();
      expect(r.error, `page ${i}`).toBeNull();
      made.push({ table: "custom_pages", id: r.data!.id });
    }
    const fourth = await client.from("custom_pages").insert({ store_id: storeId, slug: `e2e-${tag}-4`, title: "e2e 4", layout: {} });
    expect(fourth.error?.message).toMatch(/plan_limit_pages/);
  });

  it("saves a crypto wallet, refuses a bad address or a half-filled one, and stops at 5", async () => {
    const wallet = (n: number) => ({ kind: "crypto", holder_name: "Wallet", asset: "USDT", network: "TRC20", wallet_address: `T${String(n).padStart(33, "A")}` });
    const bad = await client.from("payout_methods").insert({ ...wallet(1), wallet_address: "short" } as never);
    expect(bad.error?.code).toBe("23514");
    const half = await client.from("payout_methods").insert({ kind: "crypto", holder_name: "Wallet" } as never);
    expect(half.error?.code).toBe("23514");
    for (let i = 1; i <= 5; i++) {
      const r = await client.from("payout_methods").insert(wallet(i) as never).select("id").single();
      expect(r.error, `wallet ${i}`).toBeNull();
      made.push({ table: "payout_methods", id: r.data!.id });
    }
    const sixth = await client.from("payout_methods").insert(wallet(6) as never);
    expect(sixth.error?.message).toMatch(/payout_method_limit/);
  });

  it("only takes a bank account in the company's or the director's name", async () => {
    const r = await client.from("payout_methods").insert({ kind: "bank", holder_name: "Somebody Entirely Else", bank_name: "Test Bank", ifsc: "HDFC0001234", account_last4: "1234" } as never);
    expect(r.error?.message).toMatch(/payout_holder_mismatch/);
  });

  it("keeps a store's link fixed", async () => {
    const r = await client.from("stores").update({ slug: `e2e-changed-${Date.now().toString(36)}` }).eq("id", storeId);
    expect(r.error?.message).toMatch(/store_slug_locked/);
  });
});
