import { describe, expect, it } from "vitest";
import { fontExt, fontFaceCss, fontFileError, fontLabel, isSafeFontUrl, looksLikeFont } from "./fonts";
import { themeVars } from "./store-themes";
import type { StoreTheme } from "./types";

const bytes = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const theme = (customFont?: StoreTheme["customFont"]): StoreTheme => ({ palette: "emerald", fonts: "modern", heroStyle: "left", customFont });
const font = (use: "both" | "headings" | "body" = "both") => ({ name: "Brand", src: "https://x.supabase.co/storage/v1/object/public/store-media/s/fonts/a.woff2", format: "woff2" as const, use });

describe("custom fonts", () => {
  it("takes only font files, of a sensible size", () => {
    expect(fontExt("Brand-Bold.WOFF2")).toBe("woff2");
    expect(fontExt("photo.png")).toBeUndefined();
    expect(fontFileError({ name: "a.png", size: 10 })).toMatch(/\.woff2/);
    expect(fontFileError({ name: "a.ttf", size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
    expect(fontFileError({ name: "a.ttf", size: 0 })).toMatch(/empty/);
    expect(fontFileError({ name: "a.otf", size: 1000 })).toBeNull();
  });
  it("checks the first bytes, so a renamed file isn't taken for a font", () => {
    expect(looksLikeFont(bytes("wOF2"), "woff2")).toBe(true);
    expect(looksLikeFont(bytes("wOFF"), "woff")).toBe(true);
    expect(looksLikeFont(new Uint8Array([0, 1, 0, 0]), "ttf")).toBe(true);
    expect(looksLikeFont(bytes("OTTO"), "otf")).toBe(true);
    expect(looksLikeFont(bytes("\x89PNG"), "woff2")).toBe(false);
    expect(looksLikeFont(bytes("<scr"), "ttf")).toBe(false);
  });
  it("names the font after its file", () => {
    expect(fontLabel("Brand-Display_Bold.woff2")).toBe("Brand Display Bold");
  });
  it("writes the @font-face rule, and refuses anything that could break out of it", () => {
    expect(fontFaceCss(font())).toContain('src:url("https://x.supabase.co/storage/v1/object/public/store-media/s/fonts/a.woff2") format("woff2")');
    expect(fontFaceCss(undefined)).toBe("");
    expect(isSafeFontUrl('https://x.co/a.woff2"); body{display:none')).toBe(false);
    expect(isSafeFontUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeFontUrl("http://x.co/a.woff2")).toBe(false);
    expect(fontFaceCss({ ...font(), src: 'https://x.co/a");}*{' })).toBe("");
  });
  it("replaces the headings and/or text font in the theme", () => {
    const vars = (t: StoreTheme) => themeVars(t, "light") as Record<string, string>;
    expect(vars(theme())["--font-display"]).toContain("var(--font-bricolage)");
    expect(vars(theme(font("both")))["--font-display"]).toContain("PPCustomFont");
    expect(vars(theme(font("both")))["--font-sans"]).toContain("PPCustomFont");
    expect(vars(theme(font("headings")))["--font-display"]).toContain("PPCustomFont");
    expect(vars(theme(font("headings")))["--font-sans"]).not.toContain("PPCustomFont");
    expect(vars(theme(font("body")))["--font-display"]).not.toContain("PPCustomFont");
    expect(vars({ ...theme(font()), customFont: { ...font(), src: "javascript:x" } })["--font-display"]).not.toContain("PPCustomFont");
  });
});
