import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, liftTo, readableOn } from "./color";
import { PALETTES, resolveStoreMode, themeVars } from "./store-themes";
import { isThemePref, NO_FLASH_SCRIPT, resolveTheme } from "./theme";

/** Reads one token block out of app/globals.css. */
function tokens(selectorStart: string): Record<string, string> {
  // Line endings may be Windows-style depending on the checkout
  const css = readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8").replace(/\r\n/g, "\n");
  const at = css.indexOf(selectorStart);
  if (at < 0) throw new Error(`No block for ${selectorStart}`);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("\n}", at));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2];
  return out;
}

const LIGHT = tokens(":root,\n[data-theme=\"light\"]");
const DARK = tokens(":root[data-theme=\"dark\"],");

/** Text on background pairs every screen relies on; 4.5:1 for text, 3:1 for borders and large type. */
const PAIRS: [fg: string, bg: string, min: number][] = [
  ["foreground", "background", 4.5],
  ["foreground", "surface", 4.5],
  ["foreground", "surface-sunken", 4.5],
  ["foreground", "muted", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "surface", 4.5],
  ["muted-foreground", "surface-sunken", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary-foreground", "primary-hover", 4.5],
  ["primary", "surface", 4.5],
  ["primary", "background", 4.5],
  ["primary", "primary-soft", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["accent-ink", "surface", 4.5],
  ["accent-ink", "accent-soft", 4.5],
  ["success", "surface", 4.5],
  ["success", "success-soft", 4.5],
  ["warning-ink", "surface", 4.5],
  ["warning-ink", "warning-soft", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "danger-soft", 4.5],
  ["danger-foreground", "danger", 4.5],
  ["info", "surface", 4.5],
  ["info", "info-soft", 4.5],
  ["input", "surface", 3],
  ["sidebar-admin-foreground", "sidebar-admin", 4.5],
  ["inverse-foreground", "inverse", 4.5],
  ["toast-fg", "toast-bg", 4.5],
  ["toast-muted", "toast-bg", 4.5],
];

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
])("%s tokens", (_name, t) => {
  it("defines every token the pairs use", () => {
    for (const [fg, bg] of PAIRS) {
      expect(t[fg], fg).toBeDefined();
      expect(t[bg], bg).toBeDefined();
    }
  });
  it.each(PAIRS)("%s on %s reaches %s:1", (fg, bg, min) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
});

describe("dark tokens follow the brief", () => {
  it("keeps the given surfaces and brass", () => {
    expect(DARK.background.toLowerCase()).toBe("#0a1412");
    expect(DARK.surface.toLowerCase()).toBe("#101d1a");
    expect(DARK.foreground.toLowerCase()).toBe("#eaf0ed");
    expect(DARK["muted-foreground"].toLowerCase()).toBe("#93a39d");
    expect(DARK.border.toLowerCase()).toBe("#1f322d");
    expect(DARK.accent.toLowerCase()).toBe("#c9a24f");
    expect(DARK["primary-foreground"].toLowerCase()).toBe("#06100d");
  });
});

describe("store palettes", () => {
  const FG_DARK = DARK.foreground;
  const MUTED_DARK = DARK["muted-foreground"];
  it.each(PALETTES.map((p) => [p.id, p] as const))("%s reads in light and dark", (_id, p) => {
    for (const mode of ["light", "dark"] as const) {
      const v = themeVars({ palette: p.id, fonts: "modern", heroStyle: "left" }, mode);
      const surface = v["--surface"] ?? "#FFFFFF";
      const fg = mode === "dark" ? FG_DARK : LIGHT.foreground;
      expect(contrast(fg, v["--background"]), `${mode} text on background`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, surface), `${mode} text on surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v["--primary"], surface), `${mode} primary on surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(readableOn(v["--primary"]), v["--primary"]), `${mode} button text`).toBeGreaterThanOrEqual(4.5);
      if (mode === "dark") {
        expect(contrast(MUTED_DARK, surface), "muted text on surface").toBeGreaterThanOrEqual(4.5);
        expect(contrast(v["--accent-ink"], surface), "accent text").toBeGreaterThanOrEqual(4.5);
        expect(contrast(v["--primary"], v["--primary-soft"]), "active nav").toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("lifts a dark custom accent until it reads on a dark surface", () => {
    expect(contrast(liftTo("#3F7A66", "#1F1511"), "#1F1511")).toBeGreaterThanOrEqual(4.5);
    expect(liftTo("#FFFFFF", "#000000")).toBe("#FFFFFF");
  });
  it("resolves the store theme: buyer choice, then creator default, then the site", () => {
    const t = { palette: "emerald" as const, fonts: "modern" as const, heroStyle: "left" as const };
    expect(resolveStoreMode(t, "dark")).toBe("dark");
    expect(resolveStoreMode({ ...t, mode: "light" }, "dark")).toBe("light");
    expect(resolveStoreMode({ ...t, mode: "light" }, "dark", "dark")).toBe("dark");
  });
});

describe("theme preference", () => {
  it("resolves system against the device", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(isThemePref("dark")).toBe(true);
    expect(isThemePref("blue")).toBe(false);
  });
  it("the no-flash script sets data-theme before paint", () => {
    const run = (stored: string | null, systemDark: boolean) => {
      const store = new Map<string, string>();
      if (stored) store.set("pp:theme", stored);
      const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
      new Function("localStorage", "matchMedia", "document", NO_FLASH_SCRIPT)(
        { getItem: (k: string) => store.get(k) ?? null },
        () => ({ matches: systemDark }),
        { documentElement: root }
      );
      return root.dataset.theme;
    };
    expect(run(null, true)).toBe("dark");
    expect(run(null, false)).toBe("light");
    expect(run("light", true)).toBe("light");
    expect(run("dark", false)).toBe("dark");
    expect(run("nonsense", true)).toBe("dark");
  });
});
