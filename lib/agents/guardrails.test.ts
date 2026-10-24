import { describe, expect, it } from "vitest";
import { checkWording, fillPlaceholders, forbiddenPhraseIn } from "./guardrails";

const rules = { required: ["{{amount}}", "{{customer_name}}"], allowed: ["amount", "customer_name", "due_date", "business_name"], maxChars: 400, forbidden: ["legal action", "fir", "court"] };

describe("message guardrails", () => {
  it("accepts wording that keeps the placeholders", () => {
    expect(checkWording("Hi {{customer_name}}, {{amount}} is pending. Please share a date.", rules)).toBeNull();
  });

  it("refuses missing or invented placeholders", () => {
    expect(checkWording("Hi {{customer_name}}, please pay.", rules)).toEqual({ code: "missing_placeholder", placeholder: "{{amount}}" });
    expect(checkWording("Hi {{customer_name}}, {{amount}} plus {{penalty}}.", rules)).toEqual({ code: "unknown_placeholder", placeholder: "{{penalty}}" });
  });

  it("refuses numbers the model wrote itself", () => {
    expect(checkWording("Hi {{customer_name}}, pay {{amount}} within 7 days.", rules)?.code).toBe("has_digits");
  });

  it("matches forbidden phrases as whole words only", () => {
    expect(forbiddenPhraseIn("This is our first reminder", ["fir"])).toBeNull();
    expect(forbiddenPhraseIn("We may file an FIR", ["fir"])).toBe("fir");
    expect(checkWording("Hi {{customer_name}}, {{amount}} or we take Legal  Action.", rules)).toEqual({ code: "forbidden", phrase: "legal action" });
  });

  it("refuses long messages", () => {
    expect(checkWording(`{{customer_name}} {{amount}} ${"a".repeat(400)}`, rules)?.code).toBe("too_long");
  });

  it("fills values as plain text, never as new placeholders", () => {
    expect(fillPlaceholders("Hi {{customer_name}}", { customer_name: "Ravi {{amount}}" })).toBe("Hi Ravi amount");
  });
});
