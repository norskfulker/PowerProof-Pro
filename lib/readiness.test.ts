import { describe, expect, it } from "vitest";
import { readiness } from "@/components/products/readiness";

const base = { images: [], video: undefined, files: [], kind: "other" as const };

describe("what a draft still needs", () => {
  it("a digital product needs pictures, a file and a type", () => {
    expect(readiness({ ...base, fulfilment: "digital" }, false).map((r) => [r.key, r.done])).toEqual([["images", false], ["file", false], ["classification", false]]);
  });
  it("ticks things off, and a video counts as media", () => {
    const done = readiness({ ...base, fulfilment: "digital", video: { src: "x", alt: "" } as never, files: [{ id: "f", name: "a.pdf", size: 1, mime: "x" }], kind: "ebook" }, false);
    expect(done.every((r) => r.done)).toBe(true);
  });
  it("a physical product has no file, and is classified by its collection", () => {
    const list = readiness({ ...base, fulfilment: "physical" }, true);
    expect(list.map((r) => r.key)).toEqual(["images", "classification"]);
    expect(list[1]).toMatchObject({ label: "Collection", done: true });
  });
});

import { publishBlockers } from "@/components/products/readiness";

describe("what stops a product going live", () => {
  it("a digital product needs its file; nothing else is required", () => {
    expect(publishBlockers({ fulfilment: "digital", files: [] }, false)[0]).toMatch(/file/);
    expect(publishBlockers({ fulfilment: "digital", files: [{ id: "f", name: "a.pdf", size: 1, mime: "x" }] }, false)).toEqual([]);
  });
  it("a physical product needs a collection and no file", () => {
    expect(publishBlockers({ fulfilment: "physical", files: [] }, false)[0]).toMatch(/collection/);
    expect(publishBlockers({ fulfilment: "physical", files: [] }, true)).toEqual([]);
  });
});
