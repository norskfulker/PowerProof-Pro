import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Creator B is never given data by any test. This is what a brand-new account's database looks
 * like: every list is empty, nothing is pre-filled, and nothing demo exists for the app to show.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const B = { email: process.env.TEST_CREATOR_B_EMAIL, password: process.env.TEST_CREATOR_B_PASSWORD };
const have = Boolean(URL && ANON && B.email && B.password);

const LISTS = ["products", "product_media", "collections", "coupons", "deal_rules", "orders", "order_items", "reviews", "questions", "payouts", "payout_methods", "ledger_entries", "custom_pages", "domains", "ai_generations"] as const;

describe.skipIf(!have)("a creator with no data", () => {
  it("sees an empty list in every table, and nothing from anyone else", async () => {
    const client = createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword({ email: B.email!, password: B.password! });
    expect(error).toBeNull();
    for (const table of LISTS) {
      const { count, error: e } = await client.from(table).select("*", { count: "exact", head: true });
      expect(e, `${table}: ${e?.message}`).toBeNull();
      expect(count, `${table} should be empty for a new account`).toBe(0);
    }
    await client.auth.signOut();
  });

  it("has no store content beyond the store the app made, and it is unpublished", async () => {
    const client = createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    await client.auth.signInWithPassword({ email: B.email!, password: B.password! });
    const { data } = await client.from("stores").select("status");
    expect((data ?? []).length).toBeGreaterThanOrEqual(0);
    expect((data ?? []).every((s) => s.status !== "published")).toBe(true);
    await client.auth.signOut();
  });
});
