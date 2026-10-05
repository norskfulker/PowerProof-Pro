import { describe, expect, it } from "vitest";
import { MB, checkMedia, mediaKindOf } from "./store";

const f = (name: string, type: string, size: number) => ({ name, type, size });

describe("media limits", () => {
  it("knows the kinds", () => {
    expect(mediaKindOf("image/png")).toBe("image");
    expect(mediaKindOf("image/gif")).toBe("gif");
    expect(mediaKindOf("video/mp4")).toBe("video");
    expect(mediaKindOf("application/pdf")).toBeUndefined();
  });

  it("allows images and GIFs up to 5 MB and video up to 10 MB", () => {
    expect(checkMedia(f("a.jpg", "image/jpeg", 5 * MB), ["image"])).toBeUndefined();
    expect(checkMedia(f("a.gif", "image/gif", 5 * MB), ["gif"])).toBeUndefined();
    expect(checkMedia(f("a.mp4", "video/mp4", 10 * MB), ["video"])).toBeUndefined();
  });

  it("explains files that are too big", () => {
    expect(checkMedia(f("big.jpg", "image/jpeg", 5 * MB + 1), ["image"])).toMatch(/Images can be up to 5 MB/);
    expect(checkMedia(f("big.gif", "image/gif", 6 * MB), ["gif"])).toMatch(/GIFs can be up to 5 MB/);
    expect(checkMedia(f("big.mp4", "video/mp4", 11 * MB), ["video"])).toMatch(/Videos can be up to 10 MB/);
  });

  it("rejects types the block doesn't take, and empty files", () => {
    expect(checkMedia(f("clip.mp4", "video/mp4", MB), ["image", "gif"])).toMatch(/isn't a file type/);
    expect(checkMedia(f("doc.pdf", "application/pdf", MB), ["image"])).toMatch(/isn't a file type/);
    expect(checkMedia(f("e.png", "image/png", 0), ["image"])).toMatch(/empty/);
  });
});
