import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./supabase/browser", () => ({ sb: () => ({ rpc }) }));

import { getMarketplace } from "./api/marketplace";

const row = (o: Record<string, unknown> = {}) => ({
  deal_id: "d1", title: "Planner club", pitch: "A weekly planner, every month.", billing: "subscription", billing_interval: "month",
  original_minor: 99900, price_minor: 49900, currency: "INR", product_slug: "planner", store_name: "Fixture Store", store_slug: "fixture",
  store_country: "US", fulfilment: "digital", kind: "template", cover_url: null, cover_bg: "#0F3D33", verified: true, trusted: true, units: 6,
  revenue_minor: 299400, revenue_30d_minor: 99800, rating: 4.5, reviews: 2, ends_at: null, created_at: "2026-10-01T00:00:00Z", ...o,
});

describe("marketplace deals", () => {
  beforeEach(() => rpc.mockReset());

  it("shows the original price, our price, how it's billed, the badges, units and revenue", async () => {
    rpc.mockResolvedValue({ data: [row()], error: null });
    const [d] = await getMarketplace();
    expect(d).toMatchObject({ billing: "subscription", interval: "month", percentOff: 50, verified: true, trusted: true, sold: 6, fulfilment: "digital" });
    expect(d.original).toEqual({ amount: 99900, currency: "INR" });
    expect(d.price).toEqual({ amount: 49900, currency: "INR" });
    expect(d.revenue).toEqual({ amount: 299400, currency: "INR" });
    expect(d.revenue30?.amount).toBe(99800);
    expect(d.rating).toBe(4.5);
    expect(d.country).toBe("US");
  });

  it("leaves revenue out when the seller keeps it private, and rating out with no reviews", async () => {
    rpc.mockResolvedValue({ data: [row({ revenue_minor: null, revenue_30d_minor: null, reviews: 0, rating: null, billing: "one_time", billing_interval: null })], error: null });
    const [d] = await getMarketplace();
    expect(d.revenue).toBeUndefined();
    expect(d.revenue30).toBeUndefined();
    expect(d.rating).toBeUndefined();
    expect(d.billing).toBe("one_time");
    expect(d.interval).toBeUndefined();
  });

  it("sends the filters to the database: type, payment, category, price in minor units, badge, sort", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getMarketplace({ fulfilment: "physical", billing: "one_time", kind: "template", min: 100, max: 499.5, badge: "trusted", sort: "revenue", search: " planner ", country: "DE" });
    expect(rpc).toHaveBeenCalledWith("marketplace_deals", expect.objectContaining({ p_fulfilment: "physical", p_billing: "one_time", p_kind: "template", p_min_minor: 10000, p_max_minor: 49950, p_badge: "trusted", p_sort: "revenue", p_search: "planner", p_country: "DE" }));
  });

  it("says so when it can't load", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getMarketplace()).rejects.toThrow(/couldn't load the marketplace/);
  });
});
