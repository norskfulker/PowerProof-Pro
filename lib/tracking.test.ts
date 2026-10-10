import { describe, expect, it } from "vitest";
import { classifySource, shouldCount } from "./tracking";

describe("where a visit came from", () => {
  const c = (ref: string, q = "") => classifySource(ref, q, "shop.test");
  it("reads the sites people come from", () => {
    expect(c("https://www.google.com/")).toBe("google");
    expect(c("https://www.google.co.in/search?q=x")).toBe("google");
    expect(c("https://l.instagram.com/?u=x")).toBe("instagram");
    expect(c("https://www.youtube.com/watch?v=1")).toBe("youtube");
    expect(c("https://t.co/abc")).toBe("twitter");
    expect(c("https://l.facebook.com/l.php")).toBe("facebook");
    expect(c("https://blog.example.org/post")).toBe("other");
  });
  it("prefers the link's own tag, and treats email as the newsletter", () => {
    expect(c("https://www.google.com/", "?utm_source=newsletter")).toBe("newsletter");
    expect(c("", "?utm_source=IG")).toBe("instagram");
    expect(c("", "?utm_medium=email")).toBe("newsletter");
  });
  it("counts no referrer, a bad one, and the store's own pages as direct", () => {
    expect(c("")).toBe("direct");
    expect(c("not a url")).toBe("direct");
    expect(c("https://shop.test/p/x")).toBe("direct");
  });
  it("respects Do Not Track and skips automated browsers", () => {
    expect(shouldCount({ doNotTrack: "1" })).toBe(false);
    expect(shouldCount({ webdriver: true })).toBe(false);
    expect(shouldCount({ doNotTrack: null })).toBe(true);
  });
});
