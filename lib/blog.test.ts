import { describe, expect, it } from "vitest";
import { excerptOf, uniqueSlug } from "./blog";

describe("uniqueSlug", () => {
  it("derives the link from the title", () => {
    expect(uniqueSlug("Hello World!", new Set())).toBe("hello-world");
    expect(uniqueSlug("  GST for Creators: 2026 Edition  ", new Set())).toBe("gst-for-creators-2026-edition");
  });

  it("numbers clashes instead of reusing a link", () => {
    expect(uniqueSlug("Hello World", new Set(["hello-world"]))).toBe("hello-world-2");
    expect(uniqueSlug("Hello World", new Set(["hello-world", "hello-world-2"]))).toBe("hello-world-3");
  });

  it("falls back when the title has nothing usable", () => {
    expect(uniqueSlug("!!!", new Set())).toBe("post");
    expect(uniqueSlug("!!!", new Set(["post"]))).toBe("post-2");
  });
});

describe("excerptOf", () => {
  it("strips the markup and caps the length", () => {
    expect(excerptOf("**Bold start** and a [link](https://test.invalid) here.")).toBe("Bold start and a link here.");
    expect(excerptOf("word ".repeat(100), 20)).toBe("word word word word…");
    expect(excerptOf("")).toBe("");
  });
});
