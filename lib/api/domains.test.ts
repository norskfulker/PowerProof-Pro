import { describe, expect, it } from "vitest";
import { detectProvider, DOMAIN_ISSUES, normaliseHost, validateHost } from "./domains";

describe("hosts", () => {
  it("cleans what people paste", () => {
    expect(normaliseHost(" https://www.Shop.Example-Store.in/products ")).toBe("shop.example-store.in");
  });
  it("explains bad input in plain words", () => {
    expect(validateHost("")).toMatch(/Type the domain/);
    expect(validateHost("not a domain")).toMatch(/doesn't look like a domain/);
    expect(validateHost("my-store.powerproof.store")).toMatch(/free address/);
    expect(validateHost("shop.my-store.in")).toBeUndefined();
  });
  it("detects the DNS host and whether it supports automatic setup", () => {
    expect(detectProvider("my-store.dev")).toBe("cloudflare");
    expect(detectProvider("my-store.io")).toBe("namecheap");
    expect(detectProvider("my-store.online")).toBe("hostinger");
    expect(detectProvider("weird.zz")).toBe("other");
  });
});

describe("domain problems", () => {
  it("every problem has a title, a reason and a fix", () => {
    for (const issue of Object.values(DOMAIN_ISSUES)) {
      expect(issue.title.length).toBeGreaterThan(3);
      expect(issue.reason.length).toBeGreaterThan(3);
      expect(issue.fix.length).toBeGreaterThan(3);
    }
  });
  it("the wrong-target fix points to the records on the page", () => {
    expect(DOMAIN_ISSUES.wrong_target.fix).toMatch(/value shown below/);
  });
});
