import { describe, expect, it } from "vitest";
import { effectiveBackground, tileContrastWarning, tileTextColor, withOverlay } from "./contrast";

describe("tile contrast", () => {
  it("darkens with an overlay", () => {
    expect(withOverlay("#FFFFFF", 0.5)).toBe("#808080");
    expect(withOverlay("#FFFFFF", 0)).toBe("#ffffff");
  });

  it("picks light text on dark colours and dark text on light ones", () => {
    expect(tileTextColor({ kind: "color", color: "#0F3D33" })).toBe("#F5F6F4");
    expect(tileTextColor({ kind: "color", color: "#F6EFDF" })).toBe("#0C1F1B");
  });

  it("is happy with strong colours", () => {
    expect(tileContrastWarning({ kind: "color", color: "#0F3D33" })).toBeUndefined();
  });

  it("warns on mid-tones and suggests an overlay", () => {
    const w = tileContrastWarning({ kind: "color", color: "#777777" });
    expect(w?.message).toMatch(/hard to read/);
    expect(w?.suggestOverlay).toBeGreaterThan(0);
  });

  it("treats an unknown image as mid-grey and clears the warning with enough overlay", () => {
    const img = { kind: "image" as const, src: "asset:x", alt: "", focal: { x: 50, y: 50 } };
    expect(tileContrastWarning(img)).toBeDefined();
    expect(tileContrastWarning({ ...img, overlay: 0.6 })).toBeUndefined();
    expect(effectiveBackground(img, "#000000")).toBe("#000000");
  });
});
