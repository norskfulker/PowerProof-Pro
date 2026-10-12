import { describe, expect, it } from "vitest";
import { buyerStateFor, canonicalState } from "./india";

describe("buyer state", () => {
  it("canonicalises known states and rejects the rest", () => {
    expect(canonicalState("Maharashtra")).toBe("Maharashtra");
    expect(canonicalState("  maharashtra ")).toBe("Maharashtra");
    expect(canonicalState("Narnia")).toBeUndefined();
    expect(canonicalState("")).toBeUndefined();
  });
  it("keeps a state for India only", () => {
    expect(buyerStateFor("IN", "Delhi")).toBe("Delhi");
    expect(buyerStateFor("IN", "Narnia")).toBeUndefined();
    expect(buyerStateFor("IN", undefined)).toBeUndefined();
    expect(buyerStateFor("US", "Delhi")).toBeUndefined();
  });
});
