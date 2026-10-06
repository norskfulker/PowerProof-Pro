import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "../mock/db";
import { setPlanTier } from "./account";
import {
  addDomain,
  checkSubdomain,
  connectAutomatically,
  detectProvider,
  DOMAIN_ISSUES,
  getDomains,
  markRecordsAdded,
  normaliseHost,
  removeDomain,
  setSubdomain,
  simulateDomain,
  updateDomainSettings,
  validateHost,
  verifyDomain,
} from "./domains";

const store = () => db().store.id;

beforeEach(() => resetDb("seeded"));

describe("hosts", () => {
  it("cleans what people paste", () => {
    expect(normaliseHost(" https://www.Shop.Ananya.in/products ")).toBe("shop.ananya.in");
  });
  it("explains bad input in plain words", () => {
    expect(validateHost("")).toMatch(/Type the domain/);
    expect(validateHost("not a domain")).toMatch(/doesn't look like a domain/);
    expect(validateHost("ananya.powerproof.store")).toMatch(/free address/);
    expect(validateHost("shop.ananya.in")).toBeUndefined();
  });
  it("detects the DNS host and whether it supports automatic setup", () => {
    expect(detectProvider("ananya.dev")).toBe("cloudflare");
    expect(detectProvider("ananya.io")).toBe("namecheap");
    expect(detectProvider("ananya.online")).toBe("hostinger");
    expect(detectProvider("weird.zz")).toBe("other");
  });
});

describe("free subdomain", () => {
  it("starts as the store's link and checks availability", async () => {
    expect((await getDomains(store())).subdomain).toBe(db().store.slug);
    expect((await checkSubdomain(store(), "shop")).ok).toBe(false);
    expect((await checkSubdomain(store(), "-bad")).ok).toBe(false);
    expect((await checkSubdomain(store(), "ananya-notes")).ok).toBe(true);
    await setSubdomain(store(), "ananya-notes");
    expect((await getDomains(store())).subdomain).toBe("ananya-notes");
    await expect(setSubdomain(store(), "admin")).rejects.toMatchObject({ code: "validation" });
  });
});

describe("custom domain", () => {
  it("is Pro only: Free gets the upgrade path after step 1", async () => {
    await setPlanTier("free");
    await expect(addDomain(store(), "shop.ananya.in")).rejects.toMatchObject({ code: "limit", kind: "customDomain" });
  });

  it("walks manual setup: records, waiting, verifying, SSL, connected", async () => {
    let d = await addDomain(store(), "shop.ananya.in");
    expect(d.custom?.status).toBe("not_connected");
    expect(d.custom?.records.map((r) => r.type)).toEqual(["CNAME", "TXT"]);
    d = await markRecordsAdded(store());
    expect(d.custom?.status).toBe("waiting_dns");
    d = await verifyDomain(store()); // DNS not found yet on the first check
    expect(d.custom?.status).toBe("waiting_dns");
    const seen = [];
    for (let i = 0; i < 4; i++) seen.push((d = await verifyDomain(store())).custom?.status);
    expect(seen).toEqual(["verifying", "issuing_ssl", "connected", "connected"]);
    expect(d.custom?.connectedAt).toBeTruthy();
  });

  it("uses one-click setup only where the host supports it", async () => {
    await addDomain(store(), "ananya.dev");
    expect((await connectAutomatically(store())).custom?.status).toBe("verifying");
    await removeDomain(store());
    await addDomain(store(), "ananya.io");
    await expect(connectAutomatically(store())).rejects.toMatchObject({ code: "validation" });
  });

  it("apex domains get A and www records", async () => {
    const d = await addDomain(store(), "ananya.in");
    expect(d.custom?.records.map((r) => `${r.type} ${r.name}`)).toEqual(["A @", "CNAME www", "TXT _powerproof"]);
  });

  it("shows needs attention with the reason and the fix, and recovers", async () => {
    await addDomain(store(), "ananya.in");
    const d = await simulateDomain(store(), { issue: "wrong_target" });
    expect(d.custom?.status).toBe("needs_attention");
    expect(d.custom?.records[0].found).toBe("192.0.2.44");
    expect(DOMAIN_ISSUES.wrong_target.fix).toMatch(/76\.76\.21\.21/);
    // Still broken until the creator fixes it
    expect((await verifyDomain(store())).custom?.status).toBe("needs_attention");
    await simulateDomain(store(), { issue: null, status: "waiting_dns" });
    expect((await verifyDomain(store())).custom?.status).toBe("verifying");
  });

  it("slow propagation keeps checking without blocking", async () => {
    await addDomain(store(), "ananya.in");
    await simulateDomain(store(), { status: "waiting_dns", issue: "propagation_slow" });
    expect((await getDomains(store())).custom?.status).toBe("waiting_dns");
    expect((await verifyDomain(store())).custom?.issue).toBeUndefined();
  });

  it("settings only apply once connected, and remove clears the domain", async () => {
    await addDomain(store(), "ananya.in");
    await expect(updateDomainSettings(store(), { primary: false })).rejects.toMatchObject({ code: "conflict" });
    await simulateDomain(store(), { status: "connected" });
    const d = await updateDomainSettings(store(), { wwwRedirect: "root_to_www", redirectSubdomain: false });
    expect(d.custom).toMatchObject({ wwwRedirect: "root_to_www", redirectSubdomain: false });
    expect((await removeDomain(store())).custom).toBeUndefined();
  });

  it("can force every status from the simulator", async () => {
    for (const s of ["not_connected", "waiting_dns", "verifying", "issuing_ssl", "connected", "needs_attention"] as const) {
      expect((await simulateDomain(store(), { status: s })).custom?.status).toBe(s);
    }
  });
});
