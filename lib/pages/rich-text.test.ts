import { describe, expect, it } from "vitest";
import { paragraphs, parseInline } from "./rich-text";

describe("rich text", () => {
  it("parses bold, italic and links", () => {
    expect(parseInline("Get **two** for _one_ at [the store](/s/my-store).")).toEqual([
      { kind: "text", text: "Get " },
      { kind: "bold", text: "two" },
      { kind: "text", text: " for " },
      { kind: "italic", text: "one" },
      { kind: "text", text: " at " },
      { kind: "link", text: "the store", href: "/s/my-store" },
      { kind: "text", text: "." },
    ]);
  });

  it("keeps unsafe links as plain text", () => {
    const out = parseInline("[click](javascript:alert(1))");
    expect(out.every((t) => t.kind !== "link")).toBe(true);
  });

  it("never produces HTML", () => {
    const out = parseInline("<script>alert(1)</script> **<b>x</b>**");
    expect(out.map((t) => t.text).join("")).toContain("<script>");
    expect(out.some((t) => t.kind === "bold" && t.text === "<b>x</b>")).toBe(true);
  });

  it("splits paragraphs on blank lines and drops empty ones", () => {
    expect(paragraphs("One\nstill one\n\nTwo\n\n\n\n")).toEqual(["One\nstill one", "Two"]);
  });

  it("handles plain text and empty strings", () => {
    expect(parseInline("plain")).toEqual([{ kind: "text", text: "plain" }]);
    expect(parseInline("")).toEqual([]);
  });
});
