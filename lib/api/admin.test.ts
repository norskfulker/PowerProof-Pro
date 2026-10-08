import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../supabase/browser", () => ({ sb: () => ({ rpc }) }));

import { adminSearch, getAdminCounts, getAdminCreators, getAdminOverview, getAdminPayouts, setPayoutState, setStoreSuspended } from "./admin";

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("admin api", () => {
  it("turns creator rows into screen shapes, keeping each currency separate", async () => {
    rpc.mockResolvedValue({
      data: [{ id: "u1", email: "a@x.com", full_name: null, plan: "pro", country: "IN", created_at: "2026-10-01T00:00:00Z", stores: "2", suspended: 0, orders: "5", revenue: [{ currency: "INR", amount: "150000" }, { currency: "USD", amount: 2000 }] }],
      error: null,
    });
    const [c] = await getAdminCreators();
    expect(rpc).toHaveBeenCalledWith("admin_creators", {});
    expect(c).toMatchObject({ name: "", plan: "pro", stores: 2, orders: 5 });
    expect(c.revenue).toEqual([{ currency: "INR", amount: 150000 }, { currency: "USD", amount: 2000 }]);
  });

  it("reads the overview numbers and per-currency sales", async () => {
    rpc.mockResolvedValue({
      data: { days: 7, totals: { creators: 3, gmv: [{ currency: "INR", amount: "1000" }], fees: [{ currency: "INR", amount: 30 }] }, period: { payments: 2, gmv: [{ currency: "USD", amount: 500 }], fees: [] }, series: null },
      error: null,
    });
    const o = await getAdminOverview(7);
    expect(rpc).toHaveBeenCalledWith("admin_overview", { p_days: 7 });
    expect(o.totals.gmv).toEqual([{ currency: "INR", amount: 1000 }]);
    expect(o.totals.fees).toEqual([{ currency: "INR", amount: 30 }]);
    expect(o.period.gmv).toEqual([{ currency: "USD", amount: 500 }]);
    expect(o.series).toEqual([]);
  });

  it("shows payout methods without inventing a missing one", async () => {
    rpc.mockResolvedValue({
      data: [{ id: "p1", store_name: "Shop", owner_email: null, holder_name: null, method_kind: null, method_label: null, currency: "INR", amount_minor: 50000, fee_minor: 0, status: "requested", failure_reason: null, gateway_payout_id: null, requested_at: "2026-10-02T00:00:00Z", processed_at: null }],
      error: null,
    });
    const [p] = await getAdminPayouts();
    expect(p.method).toBe("Removed method");
    expect(p.amount).toEqual({ amount: 50000, currency: "INR" });
  });

  it("sends the right arguments for each action", async () => {
    rpc.mockResolvedValue({ data: "suspended", error: null });
    await setStoreSuspended("s1", true, "counterfeit goods");
    expect(rpc).toHaveBeenLastCalledWith("admin_set_store_status", { p_store: "s1", p_suspend: true, p_reason: "counterfeit goods" });
    await setPayoutState("p1", "paid", { reference: "UTR12345" });
    expect(rpc).toHaveBeenLastCalledWith("admin_set_payout", { p_payout: "p1", p_action: "paid", p_ref: "UTR12345", p_reason: null });
  });

  it("explains refusals in plain words", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not_admin" } });
    await expect(getAdminCounts()).rejects.toThrow("Only PowerProof staff can do that.");
    rpc.mockResolvedValue({ data: null, error: { message: "reference_required" } });
    await expect(setPayoutState("p1", "paid")).rejects.toThrow(/bank or UTR reference/);
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    await expect(getAdminCounts()).rejects.toThrow(/couldn't reach PowerProof/);
  });

  it("doesn't search for fewer than two letters", async () => {
    expect(await adminSearch(" a ")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
