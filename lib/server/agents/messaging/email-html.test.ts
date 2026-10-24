import { describe, expect, it } from "vitest";
import { paragraphs, reminderEmailHtml } from "./email-html";

describe("reminder email layout", () => {
  it("uses Geist and the business name as an ExtraBold text wordmark, no image", () => {
    const html = reminderEmailHtml({ brand: "Demo Business", body: "Hi Ravi,\n\nPlease pay.", unsubscribeUrl: "https://powerproof.app/agents/optout/x" });
    expect(html).toContain("family=Geist");
    expect(html).toMatch(/font-weight:800[^>]*>Demo Business<\/p>/);
    expect(html).not.toMatch(/<img|<svg/);
    expect(html).toContain("Unsubscribe from these reminders");
  });

  it("escapes what customers or owners typed", () => {
    const html = reminderEmailHtml({ brand: "<b>Shop</b>", body: "Hi <script>x</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;Shop&lt;/b&gt;");
  });

  it("keeps paragraphs and line breaks", () => {
    expect(paragraphs("One\nline two\n\nTwo")).toBe(paragraphs("One\nline two\n\nTwo"));
    expect(paragraphs("One\nline two\n\nTwo").match(/<p /g)).toHaveLength(2);
    expect(paragraphs("One\nline two")).toContain("One<br>line two");
  });
});
