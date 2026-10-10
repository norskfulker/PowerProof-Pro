import { describe, expect, it, vi } from "vitest";
import { apexOf, cloudflareConfig, isApex, issueFrom, lookupDns, recordsFor, relativeName, wwwOf, type CustomHostname } from "./cloudflare";

const cfg = { target: "customers.powerproof.store", apexIps: [] as string[] };
const live: CustomHostname = { id: "1", hostname: "shop.yourname.in", status: "active", ssl: { status: "active" } };
const pending: CustomHostname = { id: "1", hostname: "shop.yourname.in", status: "pending", ssl: { status: "pending_validation" }, ownership_verification: { type: "txt", name: "_cf-custom-hostname.shop.yourname.in", value: "abc-123" } };

describe("custom domains on Cloudflare", () => {
  it("needs a token, a zone and a CNAME target, and is off without them", () => {
    expect(cloudflareConfig({})).toBeNull();
    expect(cloudflareConfig({ CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ZONE_ID: "z" })).toBeNull();
    expect(cloudflareConfig({ CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ZONE_ID: "z", CLOUDFLARE_CNAME_TARGET: "Customers.PowerProof.store.", CLOUDFLARE_APEX_IPS: "192.0.2.1, nonsense" })).toEqual({ token: "t", zoneId: "z", target: "customers.powerproof.store", apexIps: ["192.0.2.1"] });
  });
  it("knows a bare domain from a subdomain, including .co.in style endings", () => {
    expect(isApex("yourname.in")).toBe(true);
    expect(isApex("yourname.co.in")).toBe(true);
    expect(isApex("shop.yourname.in")).toBe(false);
    expect(apexOf("a.b.yourname.co.in")).toBe("yourname.co.in");
    expect(relativeName("_cf-custom-hostname.shop.yourname.in", "shop.yourname.in")).toBe("_cf-custom-hostname.shop");
    expect(relativeName("yourname.in", "yourname.in")).toBe("@");
  });
  it("asks for a CNAME, with www for a bare domain, and the ownership check while pending", () => {
    expect(recordsFor("shop.yourname.in", cfg, live)).toEqual([{ type: "CNAME", name: "shop", value: cfg.target }]);
    const pend = recordsFor("shop.yourname.in", cfg, pending);
    expect(pend[1]).toMatchObject({ type: "TXT", name: "_cf-custom-hostname.shop", value: "abc-123" });
    const bare = recordsFor("yourname.in", cfg, null, true);
    expect(bare.map((r) => [r.type, r.name])).toEqual([["CNAME", "@"], ["CNAME", "www"]]);
    expect(bare[0].note).toMatch(/flattening/);
    expect(recordsFor("yourname.in", { ...cfg, apexIps: ["192.0.2.1"] }, null)).toEqual([{ type: "A", name: "@", value: "192.0.2.1" }]);
    expect(wwwOf("shop.yourname.in")).toBeNull();
  });
  it("explains what is wrong from Cloudflare's answer and public DNS", () => {
    expect(issueFrom(live, { cnames: [], a: [] }, "shop.yourname.in", cfg)).toBeNull();
    expect(issueFrom(pending, { cnames: [], a: [] }, "shop.yourname.in", cfg)).toBe("missing_record");
    expect(issueFrom(pending, { cnames: ["customers.powerproof.store"], a: [] }, "shop.yourname.in", cfg)).toBe("propagation_slow");
    expect(issueFrom(pending, { cnames: ["old-host.example.com"], a: [] }, "shop.yourname.in", cfg)).toBe("wrong_target");
    expect(issueFrom(pending, { cnames: [], a: ["1.2.3.4"] }, "shop.yourname.in", cfg)).toBe("wrong_target");
    expect(issueFrom({ ...pending, ssl: { status: "pending_validation", validation_errors: [{ message: "CAA record prevents issuance" }] } }, { cnames: [cfg.target], a: [] }, "shop.yourname.in", cfg)).toBe("caa_blocks_ssl");
  });
  it("reads CNAME and A answers from DNS over HTTPS", async () => {
    const f = vi.fn(async (url: string) => ({ json: async () => (url.includes("type=CNAME") ? { Answer: [{ type: 5, data: "Customers.PowerProof.store." }] } : { Answer: [{ type: 1, data: "104.16.0.1" }] }) }));
    expect(await lookupDns("shop.yourname.in", f as never)).toEqual({ cnames: ["customers.powerproof.store"], a: ["104.16.0.1"] });
  });
});
