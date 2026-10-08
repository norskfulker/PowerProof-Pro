import { describe, expect, it } from "vitest";
import { allow } from "./limit";

describe("rate limit", () => {
  it("lets a few through, then waits, then lets more through", () => {
    const k = `t${Math.random()}`;
    expect([1, 2, 3].map((i) => allow(k, 3, 1000, 1000 + i))).toEqual([true, true, true]);
    expect(allow(k, 3, 1000, 1500)).toBe(false);
    expect(allow(k, 3, 1000, 2500)).toBe(true);
  });
  it("keeps addresses apart", () => {
    expect(allow("a1", 1, 1000, 0)).toBe(true);
    expect(allow("b1", 1, 1000, 0)).toBe(true);
    expect(allow("a1", 1, 1000, 1)).toBe(false);
  });
});
