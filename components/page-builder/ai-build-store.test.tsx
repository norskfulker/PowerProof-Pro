import { describe, expect, it } from "vitest";
import { AI_FREE_MESSAGES } from "@/lib/plans";
import { allowanceText, type AiAllowance } from "./ai-build-store";

const base: AiAllowance = { connected: true, used: 0, daily: 10, freeLeft: null };

describe("allowanceText", () => {
  it("says when AI isn't connected", () => {
    expect(allowanceText({ ...base, connected: false })).toMatch(/isn't connected/);
  });

  it("counts free messages on the Free plan", () => {
    expect(allowanceText({ ...base, freeLeft: 97 })).toBe(`97 of ${AI_FREE_MESSAGES} free messages left`);
  });

  it("points at Pro when the free messages are gone", () => {
    expect(allowanceText({ ...base, freeLeft: 0 })).toMatch(new RegExp(`your ${AI_FREE_MESSAGES} free AI messages`));
  });

  it("counts daily pages on Pro", () => {
    expect(allowanceText({ ...base, used: 3, daily: 10 })).toBe("7 of 10 AI pages left today");
    expect(allowanceText({ ...base, used: 10, daily: 10 })).toMatch(/More tomorrow/);
    expect(allowanceText({ ...base, used: 0, daily: 1 })).toBe("1 of 1 AI page left today");
  });
});
