import { describe, expect, it } from "vitest";
import { gstinChecksum, isValidGstin, matchState, parseGstRecord, readGstin } from "./gstin";

/** A GSTIN with a correct check character, made from a PAN-shaped fixture */
const body = "27ABCPR1234F1Z";
const GSTIN = body + gstinChecksum(body);

describe("GSTIN", () => {
  it("accepts a number whose check character fits and rejects a changed one", () => {
    expect(isValidGstin(GSTIN)).toBe(true);
    expect(isValidGstin(GSTIN.toLowerCase())).toBe(true);
    const wrong = GSTIN.slice(0, 14) + (GSTIN[14] === "A" ? "B" : "A");
    expect(isValidGstin(wrong)).toBe(false);
    expect(isValidGstin("27ABCPR1234F1Z")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
  it("reads the state and the PAN from the number itself", () => {
    const f = readGstin(GSTIN);
    expect(f.state).toBe("Maharashtra");
    expect(f.pan).toBe("ABCPR1234F");
    expect(f.businessType).toBe("proprietorship");
    expect(readGstin("07AAACG2115R1ZN").state).toBe("Delhi");
    expect(readGstin("29AABCU9603R1ZX").businessType).toBe("private_limited");
  });
});

describe("what a GST data provider returns", () => {
  const portal = { lgnm: "Fixture Traders", tradeNam: "Fixture Studio", sts: "Active", pradr: { addr: { bno: "12", bnm: "Test Tower", st: "Main Road", loc: "Fixtureville", dst: "Pune", stcd: "Maharashtra", pncd: "411001" } } };
  it("reads the portal's own field names, bare or wrapped", () => {
    for (const body of [portal, { data: portal }, { taxpayerInfo: portal }]) {
      const c = parseGstRecord(body)!;
      expect(c.legalName).toBe("Fixture Traders");
      expect(c.tradeName).toBe("Fixture Studio");
      expect(c.status).toBe("Active");
      expect(c.address1).toBe("12, Test Tower, Main Road");
      expect(c.address2).toBe("Fixtureville");
      expect(c.city).toBe("Pune");
      expect(c.pincode).toBe("411001");
    }
  });
  it("reads plain-English spellings and a one-line address", () => {
    const c = parseGstRecord({ result: { legal_name: "Plain Name", status: "Cancelled", pradr: { adr: "Shop 4, Lane 2, Town, Pune, Maharashtra, 411001" } } })!;
    expect(c.legalName).toBe("Plain Name");
    expect(c.status).toBe("Cancelled");
    expect(c.address1).toBe("Shop 4, Lane 2");
  });
  it("says nothing was found instead of inventing a company", () => {
    expect(parseGstRecord({})).toBeUndefined();
    expect(parseGstRecord(null)).toBeUndefined();
    expect(parseGstRecord({ data: { sts: "Active" } })).toBeUndefined();
    expect(parseGstRecord("nope")).toBeUndefined();
  });
  it("matches a provider's state name to ours", () => {
    expect(matchState("NCT of Delhi")).toBe("Delhi");
    expect(matchState("Jammu & Kashmir")).toBe("Jammu and Kashmir");
    expect(matchState("Maharashtra")).toBe("Maharashtra");
    expect(matchState("Atlantis")).toBeUndefined();
  });
});
