import { describe, expect, it } from "vitest";
import { analyze, type ItemRow, type OrderRow } from "./analytics-detail";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const order = (o: Partial<OrderRow>): OrderRow => ({
  id: "o1",
  status: "paid",
  payment_method: "online",
  total_minor: 100_00,
  discount_minor: 0,
  shipping_minor: 0,
  buyer_email: "a@x.in",
  buyer_country: "IN",
  buyer_state: "Kerala",
  created_at: "2026-10-13T04:30:00Z",
  paid_at: "2026-10-13T04:30:00Z",
  shipped_at: null,
  fulfilment_status: null,
  reminded_at: null,
  ...o,
});

describe("analyze", () => {
  const orders = [
    order({ id: "o1" }),
    order({ id: "o2", buyer_email: "A@x.in", total_minor: 300_00, discount_minor: 50_00, buyer_state: "Goa" }),
    order({ id: "o3", status: "refunded", buyer_email: "b@x.in", buyer_country: "US", buyer_state: null }),
    order({ id: "o4", status: "cod", payment_method: "cod", total_minor: 80_00, buyer_email: "c@x.in" }),
    // Left two hours ago, reminded, then the buyer came back and paid
    order({ id: "o5", status: "pending", buyer_email: "d@x.in", created_at: "2026-10-14T09:00:00Z", reminded_at: "2026-10-14T10:00:00Z", total_minor: 40_00 }),
    order({ id: "o6", status: "paid", buyer_email: "d@x.in", created_at: "2026-10-14T11:00:00Z", paid_at: "2026-10-14T11:00:00Z", total_minor: 40_00 }),
    // Still paying (started minutes ago): not abandoned yet
    order({ id: "o7", status: "pending", buyer_email: "e@x.in", created_at: "2026-10-14T11:50:00Z" }),
    order({ id: "o8", status: "failed", buyer_email: "f@x.in", total_minor: 20_00 }),
  ];
  const items: ItemRow[] = [
    { order_id: "o1", product_id: "p1", title: "Ebook", quantity: 1, line_total_minor: 100_00 },
    { order_id: "o2", product_id: "p2", title: "Course", quantity: 1, line_total_minor: 300_00 },
    { order_id: "o5", product_id: "p1", title: "Ebook", quantity: 1, line_total_minor: 40_00 },
  ];
  const d = analyze(orders, items, new Set(["b@x.in"]), NOW);

  it("counts sales, refunds and cash still to collect", () => {
    expect(d.gross).toBe(100_00 + 300_00 + 100_00 + 40_00);
    expect(d.refunds).toBe(100_00);
    expect(d.net).toBe(d.gross - d.refunds);
    expect(d.orders).toBe(5);
    expect(d.codPending).toBe(80_00);
    expect(d.discountGiven).toBe(50_00);
  });

  it("knows returning buyers, ignoring email case", () => {
    // a@x.in twice, b@x.in bought before the period
    expect(d.buyers).toBe(3);
    expect(d.returning).toBe(2);
  });

  it("ranks products by revenue from sold orders only", () => {
    expect(d.products.map((p) => p.title)).toEqual(["Course", "Ebook"]);
    expect(d.products[1].units).toBe(1);
  });

  it("finds abandoned and recovered checkouts", () => {
    expect(d.checkout.started).toBe(8);
    expect(d.checkout.abandoned).toBe(2);
    expect(d.checkout.reminded).toBe(1);
    expect(d.checkout.recovered).toBe(1);
  });

  it("places orders on India's weekday and hour", () => {
    // 2026-10-13 04:30 UTC is Tuesday 10:00 IST
    expect(d.heat[1][10]).toBe(3);
    expect(d.states[0].key).toBe("Goa");
  });
});
