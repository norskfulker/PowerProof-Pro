import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let rules: unknown[] = [];
vi.mock("../supabase/browser", () => ({
  sb: () => ({ rpc, from: () => ({ select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: rules }) }) }) }) }),
}));

import { getQuote } from "./checkout";
import { getPublicOrder, lookupOrder, submitReview } from "./public-orders";

const inr = (amount: number) => ({ amount, currency: "INR" as const });
const cart = { storeId: "s1", products: [{ id: "a", title: "A", price: inr(50000) }, { id: "b", title: "B", price: inr(30000) }] };
const rule = { id: "r1", name: "Bundle", active: true, reward: "percent_off", percent_bps: 2500, reward_product_id: null, trigger_product_ids: ["a", "b"], starts_at: null, ends_at: null, created_at: "2026-01-01T00:00:00Z" };

beforeEach(() => {
  rpc.mockReset();
  rules = [];
});

describe("the live total", () => {
  it("needs no code: the total is the cart", async () => {
    const q = await getQuote(cart, "");
    expect(q).toMatchObject({ subtotal: 80000, dealSaving: 0, codeOff: 0, total: 80000 });
    expect(q.coupon).toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("applies the store's deal paths, read from the database", async () => {
    rules = [rule];
    const q = await getQuote(cart, "");
    expect(q).toMatchObject({ subtotal: 80000, dealSaving: 20000, total: 60000 });
  });

  it("asks the database whether a code works, and takes its discount off after deals", async () => {
    rules = [rule];
    rpc.mockResolvedValue({ data: [{ out_coupon_id: "c1", out_discount_minor: 6000 }], error: null });
    const q = await getQuote(cart, " save10 ");
    expect(rpc).toHaveBeenCalledWith("validate_coupon", { p_store: "s1", p_code: "save10", p_subtotal: 60000, p_product: undefined });
    expect(q).toMatchObject({ codeOff: 6000, total: 54000, coupon: { ok: true } });
  });

  it("finds a code that is for one product by trying each product's line", async () => {
    rpc.mockImplementation(async (_n: string, a: { p_product?: string; p_subtotal: number }) => (a.p_product === "b" ? { data: [{ out_coupon_id: "c1", out_discount_minor: 3000 }], error: null } : { data: null, error: { message: "invalid coupon" } }));
    const q = await getQuote(cart, "ONLYB");
    expect(q).toMatchObject({ codeOff: 3000, total: 77000, coupon: { ok: true } });
    expect(rpc).toHaveBeenCalledWith("validate_coupon", expect.objectContaining({ p_product: "b", p_subtotal: 30000 }));
  });

  it("never takes more off than the order costs", async () => {
    rpc.mockResolvedValue({ data: [{ out_coupon_id: "c1", out_discount_minor: 999999 }], error: null });
    expect((await getQuote(cart, "BIG")).total).toBe(0);
  });

  it("a code that doesn't work leaves the total alone and says so", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "invalid coupon" } });
    const q = await getQuote(cart, "nope");
    expect(q).toMatchObject({ codeOff: 0, total: 80000, coupon: { ok: false } });
    expect(q.coupon?.message).toMatch(/doesn't work for this order/);
  });
});

describe("a buyer's order, straight from the database", () => {
  it("opens an order by its link token and tidies the analytics tags", async () => {
    rpc.mockResolvedValue({ data: { id: "o1", ref: "PP/DP/X", analytics: { ga4Id: "g-abc123xyz", clarityId: "BAD!" }, lines: [], files: [], reviewed: [] }, error: null });
    const o = await getPublicOrder("t".repeat(48));
    expect(rpc).toHaveBeenCalledWith("get_order", { p_token: "t".repeat(48) });
    expect(o.analytics).toEqual({ ga4Id: "G-ABC123XYZ" });
  });
  it("says so for a link that has expired, and for a database that can't answer", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(getPublicOrder("x")).rejects.toThrow(/expired or isn't valid/);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(getPublicOrder("x")).rejects.toThrow(/can't be opened right now/);
  });
  it("finds an order by email and number, with one answer for every miss", async () => {
    rpc.mockResolvedValueOnce({ data: "tok", error: null });
    expect(await lookupOrder("a@b.co", "PP/DP/X")).toBe("tok");
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(lookupOrder("a@b.co", "nope")).rejects.toThrow(/couldn't find a paid order/);
  });
  it("posts a review, and treats a second one as already done", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    expect(await submitReview("t", "p", { rating: 5 })).toBe(true);
    rpc.mockResolvedValueOnce({ error: { message: "review_exists" } });
    expect(await submitReview("t", "p", { rating: 5 })).toBe(false);
    rpc.mockResolvedValueOnce({ error: { message: "review_link_invalid" } });
    await expect(submitReview("t", "p", { rating: 5 })).rejects.toThrow(/expired/);
  });
});
