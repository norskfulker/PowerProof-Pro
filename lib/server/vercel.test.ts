import { describe, expect, it } from "vitest";
import { APEX_TARGET, CNAME_TARGET, isApex, issueFrom, recordsFor, vercelConfig } from "./vercel";

describe("custom domain records", () => {
  it("needs a token and a project, and is off without them", () => {
    expect(vercelConfig({})).toBeNull();
    expect(vercelConfig({ VERCEL_API_TOKEN: "t" })).toBeNull();
    expect(vercelConfig({ VERCEL_API_TOKEN: "t", VERCEL_PROJECT_ID: "p", VERCEL_TEAM_ID: "team" })).toEqual({ token: "t", projectId: "p", teamId: "team" });
  });
  it("knows a bare domain from a subdomain, including .co.in style endings", () => {
    expect(isApex("yourname.in")).toBe(true);
    expect(isApex("yourname.co.in")).toBe(true);
    expect(isApex("shop.yourname.in")).toBe(false);
    expect(isApex("shop.yourname.co.in")).toBe(false);
  });
  it("asks for an A record on a bare domain and a CNAME on a subdomain", () => {
    expect(recordsFor("yourname.in")).toEqual([{ type: "A", name: "@", value: APEX_TARGET }]);
    expect(recordsFor("shop.yourname.in")).toEqual([{ type: "CNAME", name: "shop", value: CNAME_TARGET }]);
  });
  it("adds the ownership proof the host asks for, with a name relative to the domain", () => {
    const r = recordsFor("shop.yourname.in", [{ type: "TXT", domain: "_vercel.yourname.in", value: "vc-domain-verify=shop.yourname.in,abc" }]);
    expect(r[1]).toMatchObject({ type: "TXT", value: "vc-domain-verify=shop.yourname.in,abc" });
  });
  it("explains what is wrong from what the host saw", () => {
    expect(issueFrom({ verified: true, misconfigured: false }, "a.in")).toBeNull();
    expect(issueFrom({ verified: false, misconfigured: true }, "a.in")).toBe("missing_record");
    expect(issueFrom({ verified: true, misconfigured: true, aValues: ["1.2.3.4"] }, "a.in")).toBe("wrong_target");
    expect(issueFrom({ verified: true, misconfigured: true, aValues: [APEX_TARGET] }, "a.in")).toBe("propagation_slow");
    expect(issueFrom({ verified: true, misconfigured: true, cnames: ["other.example.com"] }, "shop.a.in")).toBe("wrong_target");
  });
});
