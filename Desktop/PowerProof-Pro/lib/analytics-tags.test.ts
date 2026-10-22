import { describe, expect, it } from "vitest";
import { cleanTags, clarityError, ga4Error, hasTags } from "./analytics-tags";

describe("analytics tags", () => {
  it("accepts a real-looking GA4 ID in any case and refuses anything else", () => {
    expect(ga4Error("g-abc123xyz")).toBeNull();
    expect(ga4Error("")).toBeNull();
    expect(ga4Error("UA-123456-1")).toMatch(/G-ABC123XYZ/);
    expect(ga4Error('G-ABC123"></script><script>alert(1)')).not.toBeNull();
  });
  it("accepts a Clarity ID and refuses anything that isn't one", () => {
    expect(clarityError("abcd1234ef")).toBeNull();
    expect(clarityError("abc")).not.toBeNull();
    expect(clarityError("abcd1234ef/../x")).not.toBeNull();
  });
  it("keeps only what is valid, tidied", () => {
    expect(cleanTags({ ga4Id: " g-abc123xyz ", clarityId: "NOPE!" })).toEqual({ ga4Id: "G-ABC123XYZ" });
    expect(cleanTags(undefined)).toEqual({});
    expect(hasTags({ clarityId: "abcd1234ef" })).toBe(true);
    expect(hasTags({ ga4Id: "bad" })).toBe(false);
  });
});
