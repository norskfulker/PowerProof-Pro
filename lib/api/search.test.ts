import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../mock/db";
import { classify, getAuditLog, revealContact, runQuickAction, search } from "./search";

beforeEach(() => resetDb("seeded"));

describe("classify", () => {
  it("reads order numbers", () => {
    expect(classify("#1042")).toEqual({ kind: "order", digits: "1042" });
    expect(classify("PP-1042")).toEqual({ kind: "order", digits: "1042" });
    expect(classify("1042")).toEqual({ kind: "order", digits: "1042" });
  });
  it("reads emails, phones, stores and invoices", () => {
    expect(classify("priya@gmail.com").kind).toBe("email");
    expect(classify("priya@").kind).toBe("email");
    expect(classify("+91 98765 43210")).toEqual({ kind: "phone", digits: "919876543210" });
    expect(classify("@inkwell freelancer")).toEqual({ kind: "store", slug: "inkwell", rest: "freelancer" });
    expect(classify("INV-0012").kind).toBe("invoice");
  });
  it("falls back to words", () => {
    expect(classify("  second  brain ")).toEqual({ kind: "text", words: ["second", "brain"] });
  });
});

describe("search", () => {
  it("finds an order by number in the admin scope", async () => {
    const r = await search("#1042");
    expect(r.pattern).toBe("order");
    expect(r.groups[0].type).toBe("order");
    expect(r.groups[0].results[0].title).toBe("PP-1042");
  });

  it("masks buyer emails for admins but not for creators", async () => {
    const admin = await search("#1042");
    const creator = await search("#1042", { scope: "creator" });
    expect(admin.groups[0].results[0].email).toMatch(/••••@/);
    expect(admin.groups[0].results[0].masked).toBe(true);
    expect(creator.groups[0].results[0].email).not.toMatch(/••••/);
  });

  it("matches a full email without returning it", async () => {
    const first = await search("#1042", { scope: "creator" });
    const email = first.groups[0].results[0].email!;
    const r = await search(email);
    expect(r.pattern).toBe("email");
    expect(JSON.stringify(r.groups)).not.toContain(email);
    expect(r.total).toBeGreaterThan(0);
  });

  it("limits to a store with @slug and creators to their own store", async () => {
    const r = await search("@inkwell");
    expect(r.groups.flatMap((g) => g.results).every((x) => x.storeSlug === "inkwell")).toBe(true);
    const mine = await search("freelance", { scope: "creator" });
    expect(mine.total).toBeGreaterThan(0);
    expect(mine.groups.flatMap((g) => g.results).every((x) => x.storeSlug === "ananya")).toBe(true);
    const everyone = await search("freelance");
    expect(everyone.groups.flatMap((g) => g.results).some((x) => x.storeSlug === "inkwell")).toBe(true);
  });

  it("caps each group at five and reports the total", async () => {
    const r = await search("@ananya");
    const orders = r.groups.find((g) => g.type === "order")!;
    expect(orders.results).toHaveLength(5);
    expect(orders.total).toBeGreaterThan(5);
  });

  it("applies type, status and date filters", async () => {
    const r = await search("@ananya", { filters: { types: ["order"], status: "refunded", days: 3650 } });
    expect(r.groups.map((g) => g.type)).toEqual(["order"]);
    expect(r.groups[0].results.every((x) => x.status === "refunded")).toBe(true);
  });

  it("returns nothing for an empty query or no match", async () => {
    expect((await search("   ")).total).toBe(0);
    expect((await search("zzzz-no-such-thing")).groups).toEqual([]);
  });
});

describe("reveal and quick actions", () => {
  it("reveals an email and writes it to the audit log", async () => {
    const r = await search("#1042");
    const hit = r.groups[0].results[0];
    const email = await revealContact("order", hit.id, "email", "Buyer asked for a resend");
    expect(email).toContain("@");
    const log = await getAuditLog();
    expect(log[0]).toMatchObject({ action: "reveal_email", targetId: hit.id, reason: "Buyer asked for a resend" });
  });

  it("refunds from search and logs it", async () => {
    const r = await search("#1081");
    await runQuickAction("refund", "order", r.groups[0].results[0].id, "Duplicate charge");
    const after = await search("#1081");
    expect(after.groups[0].results[0].status).toBe("refunded");
    expect((await getAuditLog())[0].action).toBe("refund");
  });

  it("refuses actions a record doesn't offer", async () => {
    const r = await search("#1042", { filters: { types: ["invoice"] } });
    const inv = r.groups[0]?.results[0];
    if (inv) await expect(runQuickAction("refund", "invoice", inv.id)).rejects.toThrow();
  });
});
