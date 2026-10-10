import { describe, expect, it } from "vitest";
import { can, needForPath, OWNER_ACCESS, type StoreAccess } from "./team";

const member = (areas: StoreAccess["areas"]): StoreAccess => ({ role: "member", areas });

describe("team access", () => {
  it("lets the owner do everything, and hides nothing until access is known", () => {
    for (const need of ["catalog", "orders", "team", "owner", "any"] as const) {
      expect(can(OWNER_ACCESS, need)).toBe(true);
      expect(can(undefined, need)).toBe(true);
    }
  });
  it("gives admins every area and the team, but not the owner's money and plan", () => {
    const admin: StoreAccess = { role: "admin", areas: [] };
    expect(can(admin, "design")).toBe(true);
    expect(can(admin, "team")).toBe(true);
    expect(can(admin, "owner")).toBe(false);
  });
  it("gives a limited member only their areas", () => {
    const m = member(["orders"]);
    expect(can(m, "orders")).toBe(true);
    expect(can(m, "catalog")).toBe(false);
    expect(can(m, "team")).toBe(false);
    expect(can(m, "any")).toBe(true);
  });
  it("knows which area each screen needs", () => {
    expect(needForPath("/catalog/products/123")).toBe("catalog");
    expect(needForPath("/catalog/bundles")).toBe("marketing");
    expect(needForPath("/catalog/deals/new")).toBe("marketing");
    expect(needForPath("/sales/orders/1")).toBe("orders");
    expect(needForPath("/sales/payouts/balance")).toBe("owner");
    expect(needForPath("/store/abc/design/pages/home/edit")).toBe("design");
    expect(needForPath("/store/abc/offers/coupons")).toBe("marketing");
    expect(needForPath("/store/abc/settings")).toBe("business");
    expect(needForPath("/store/abc/domain")).toBe("design");
    expect(needForPath("/settings/billing")).toBe("owner");
    expect(needForPath("/settings/company")).toBe("business");
    expect(needForPath("/settings/team")).toBe("any");
    expect(needForPath("/settings/profile")).toBe("any");
    expect(needForPath("/dashboard")).toBe("any");
  });
});
