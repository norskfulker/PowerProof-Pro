import { describe, expect, it, vi } from "vitest";
import { cleanPath, isAppHost, isSiteHost, primaryDomain, resolveHost, rewriteTarget, storePath, wwwTarget } from "./domain-routing";

describe("custom domain routing", () => {
  it("knows which hosts are ours", () => {
    const site = "https://powerproof.app/";
    expect(isAppHost("powerproof.app", site)).toBe(true);
    expect(isAppHost("www.powerproof.app", site)).toBe(true);
    expect(isAppHost("localhost:3000", site)).toBe(true);
    expect(isAppHost("powerproof.team.workers.dev", site)).toBe(true);
    expect(isAppHost("shop.yourname.in", site)).toBe(false);
  });

  it("serves a store's pages from /s/<store>, and leaves buyer pages and the API alone", () => {
    expect(rewriteTarget("/", "fix")).toBe("/s/fix");
    expect(rewriteTarget("/planner", "fix")).toBe("/s/fix/planner");
    expect(rewriteTarget("/p/launch", "fix")).toBe("/s/fix/p/launch");
    expect(rewriteTarget("/order/abc", "fix")).toBeNull();
    expect(rewriteTarget("/success/1", "fix")).toBeNull();
    expect(rewriteTarget("/invoice/1", "fix")).toBeNull();
    expect(rewriteTarget("/lookup", "fix")).toBeNull();
    expect(rewriteTarget("/api/checkout", "fix")).toBeNull();
    expect(rewriteTarget("/_next/static/x.js", "fix")).toBeNull();
    expect(rewriteTarget("/s/other/x", "fix")).toBeNull();
  });

  it("asks the database once a minute, remembers misses, and never trusts an odd answer", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => "fix" });
    expect(await resolveHost("cache1.example.in", "https://db", "k", 1000, f as never)).toBe("fix");
    expect(await resolveHost("CACHE1.example.in", "https://db", "k", 30_000, f as never)).toBe("fix");
    expect(f).toHaveBeenCalledTimes(1);
    expect(await resolveHost("cache1.example.in", "https://db", "k", 70_000, f as never)).toBe("fix");
    expect(f).toHaveBeenCalledTimes(2);
    const odd = vi.fn().mockResolvedValue({ ok: true, json: async () => "../../etc" });
    expect(await resolveHost("odd.example.in", "https://db", "k", 1, odd as never)).toBeNull();
    const none = vi.fn().mockResolvedValue({ ok: true, json: async () => null });
    expect(await resolveHost("none.example.in", "https://db", "k", 1, none as never)).toBeNull();
  });

  it("keeps serving the last answer when the database can't be reached", async () => {
    const good = vi.fn().mockResolvedValue({ ok: true, json: async () => "fix" });
    await resolveHost("keep.example.in", "https://db", "k", 1, good as never);
    const down = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await resolveHost("keep.example.in", "https://db", "k", 100_000, down as never)).toBe("fix");
  });

  it("sends /s/<store> links on a store's own domain to the clean address, and leaves other stores alone", () => {
    expect(cleanPath("/s/fix", "fix")).toBe("/");
    expect(cleanPath("/s/fix/planner", "fix")).toBe("/planner");
    expect(cleanPath("/s/other/planner", "fix")).toBeNull();
    expect(cleanPath("/planner", "fix")).toBeNull();
    expect(storePath("/s/fix/p/launch")).toEqual({ slug: "fix", rest: "/p/launch" });
    expect(storePath("/dashboard")).toBeNull();
  });

  it("knows the bare domain a www address belongs to", () => {
    expect(wwwTarget("www.yourname.in")).toBe("yourname.in");
    expect(wwwTarget("www.yourname.co.in:443")).toBe("yourname.co.in");
    expect(wwwTarget("shop.yourname.in")).toBeNull();
    expect(wwwTarget("www.in")).toBeNull();
  });

  it("only redirects to a store's domain from PowerProof's production address", () => {
    const site = "https://powerproof.app";
    expect(isSiteHost("powerproof.app", site)).toBe(true);
    expect(isSiteHost("www.powerproof.app", site)).toBe(true);
    expect(isSiteHost("localhost:3000", site)).toBe(false);
    expect(isSiteHost("powerproof.team.workers.dev", site)).toBe(false);
    expect(isSiteHost("powerproof.app", undefined)).toBe(false);
  });

  it("accepts only a hostname as a store's primary domain", async () => {
    const good = vi.fn().mockResolvedValue({ ok: true, json: async () => "Shop.Example.in" });
    expect(await primaryDomain("p1", "https://db", "k", 1, good as never)).toBe("shop.example.in");
    const bad = vi.fn().mockResolvedValue({ ok: true, json: async () => "evil.com/phish" });
    expect(await primaryDomain("p2", "https://db", "k", 1, bad as never)).toBeNull();
  });
});
