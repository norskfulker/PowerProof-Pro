import { describe, expect, it } from "vitest";
import { flagOf } from "./countries";

describe("flags", () => {
  it("makes the flag from the two letters, and a globe for anything else", () => {
    expect(flagOf("IN")).toBe("🇮🇳");
    expect(flagOf("US")).toBe("🇺🇸");
    expect(flagOf("de")).toBe("🌐");
    expect(flagOf(undefined)).toBe("🌐");
  });
});
