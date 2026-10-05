import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone, phoneDigits } from "./mask";

describe("maskEmail", () => {
  it("keeps two characters and the domain", () => {
    expect(maskEmail("priya.sharma@gmail.com")).toBe("pr••••@gmail.com");
  });
  it("handles very short local parts and junk", () => {
    expect(maskEmail("a@b.co")).toBe("a••••@b.co");
    expect(maskEmail("not-an-email")).toBe("••••");
  });
  it("never leaks the full local part", () => {
    const long = "support.refunds.and.everything.else@example.com";
    expect(maskEmail(long)).not.toContain("refunds");
  });
});

describe("maskPhone", () => {
  it("keeps the country code and last four digits", () => {
    expect(maskPhone("+91 98765 43210")).toBe("+91 ••••••3210");
    expect(maskPhone("+1 4155550123")).toBe("+1 ••••••0123");
  });
  it("works without a country code", () => {
    expect(maskPhone("9876543210")).toBe("••••••3210");
  });
  it("hides short numbers entirely", () => {
    expect(maskPhone("+44 123")).toBe("+44 ••••");
  });
});

describe("phoneDigits", () => {
  it("strips formatting", () => {
    expect(phoneDigits("+91 98765-43210")).toBe("919876543210");
  });
});
