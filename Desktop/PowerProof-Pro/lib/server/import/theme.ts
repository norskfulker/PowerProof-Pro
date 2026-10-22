import "server-only";
import { FetchBlocked, safeFetch } from "../safe-fetch";
import { ImportError } from "./sources";
import type { CopiedLook } from "@/lib/import/look";

/**
 * Reads another store's look from its address: its colours, fonts, button corners and the kinds
 * of sections its home page has, in order. Shopify themes name all of these (CSS variables and
 * section ids), so they come across closely; other sites are read from their stylesheets.
 * Nothing is copied but the look: no text, pictures or code.
 */

const HTML = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8";
const MAX_SHEETS = 4;

type Rgb = [number, number, number];

const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** "#abc", "#aabbcc", "rgb(1,2,3)", "1, 2, 3" (Shopify's variables) → rgb */
function parseColor(v: string): Rgb | undefined {
  const s = v.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return m[1].split("").map((c) => parseInt(c + c, 16)) as Rgb;
  m = s.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as Rgb;
  m = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = s.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return undefined;
}

const luminance = ([r, g, b]: Rgb) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const saturation = ([r, g, b]: Rgb) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};

/** CSS custom properties, the last value of each name winning (as in the browser) */
function cssVars(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)/g)) out.set(m[1].toLowerCase(), m[2].trim());
  return out;
}

/** A variable's colour, following var(--other) once or twice */
function varColor(vars: Map<string, string>, names: string[]): Rgb | undefined {
  for (const name of names) {
    let v = vars.get(name);
    for (let i = 0; v && i < 3; i++) {
      const ref = v.match(/^var\(\s*(--[\w-]+)/)?.[1];
      if (!ref) break;
      v = vars.get(ref.toLowerCase());
    }
    const c = v ? parseColor(v) : undefined;
    if (c) return c;
  }
  return undefined;
}

/** The most used colourful colour in the CSS: usually the brand */
function commonBrand(css: string): Rgb | undefined {
  const counts = new Map<string, { c: Rgb; n: number }>();
  for (const m of css.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]+\)/gi)) {
    const c = parseColor(m[0]);
    if (!c || saturation(c) < 0.25 || luminance(c) > 0.85 || luminance(c) < 0.02) continue;
    const k = hex(c);
    counts.set(k, { c, n: (counts.get(k)?.n ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.c;
}

const cleanFont = (f: string) => f.split(",")[0].replace(/["']/g, "").replace(/\+/g, " ").trim();

function fonts(html: string, css: string, vars: Map<string, string>): { heading?: string; body?: string } {
  const heading = vars.get("--font-heading-family") ?? vars.get("--font-heading") ?? vars.get("--heading-font-family") ?? css.match(/h1[^{]*\{[^}]*font-family\s*:\s*([^;}]+)/i)?.[1];
  const body = vars.get("--font-body-family") ?? vars.get("--font-body") ?? vars.get("--body-font-family") ?? css.match(/body[^{]*\{[^}]*font-family\s*:\s*([^;}]+)/i)?.[1];
  const google = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?[^"']*?family=([^:&"']+)/gi)].map((m) => decodeURIComponent(m[1]));
  const ok = (f?: string) => (f && !/^var\(/.test(f) ? cleanFont(f) : undefined);
  return { heading: ok(heading) ?? (google[0] ? cleanFont(google[0]) : undefined), body: ok(body) ?? (google[1] ? cleanFont(google[1]) : google[0] ? cleanFont(google[0]) : undefined) };
}

/** Our closest font pairing for what the site uses */
function fontPair(f: { heading?: string; body?: string }): CopiedLook["fontPair"] {
  const h = (f.heading ?? "").toLowerCase();
  if (/serif|playfair|fraunces|lora|merriweather|garamond|baskerville|libre|cormorant|dm serif|georgia|times|bodoni|caslon|crimson/.test(h) && !/sans/.test(h)) return "editorial";
  if (/space|mono|plex|archivo|syne|unbounded|clash|satoshi|general sans/.test(h)) return "clean";
  if (/bricolage|grotesk|poppins|montserrat|outfit|sora|manrope|lexend|rubik|work sans|josefin|league|oswald|bebas|anton/.test(h)) return "expressive";
  return "modern";
}

function corners(css: string, vars: Map<string, string>): CopiedLook["corners"] {
  const raw = vars.get("--buttons-radius") ?? vars.get("--button-radius") ?? vars.get("--btn-radius") ?? vars.get("--radius") ?? css.match(/\.(?:btn|button)[\w-]*[^{]*\{[^}]*border-radius\s*:\s*([^;}]+)/i)?.[1];
  const px = raw ? parseFloat(raw) * (/rem|em/.test(raw) ? 16 : 1) : NaN;
  if (Number.isNaN(px)) return undefined;
  return px <= 2 ? "sharp" : px >= 18 ? "round" : "soft";
}

/** What a section name (Shopify's section type, or a class/id on other sites) is, as one of our presets */
const SECTION_MAP: [RegExp, string][] = [
  [/slideshow|image[_-]?banner|hero|banner/, "image-banner"],
  [/image[_-]?with[_-]?text|media[_-]?with[_-]?text|split/, "image-with-text"],
  [/rich[_-]?text|text[_-]?block|intro/, "rich-text"],
  [/featured[_-]?(collection|product)|product[_-]?(grid|list|carousel)|best[_-]?sell|new[_-]?arrival|products/, "featured-products"],
  [/collection[_-]?list|categor|collections/, "collection-list"],
  [/multicolumn|multi[_-]?row|features|icon[_-]?with[_-]?text|benefits|usp/, "highlights"],
  [/testimonial|review|quote/, "testimonials"],
  [/collapsible|faq|accordion/, "faq"],
  [/newsletter|email[_-]?signup|subscribe/, "newsletter"],
  [/video/, "video"],
  [/logo[_-]?list|marquee|scrolling|ticker|press/, "marquee"],
  [/collage|gallery|lookbook/, "gallery"],
  [/countdown|timer/, "countdown"],
  [/contact[_-]?form|contact/, "lead-form"],
  [/about|story/, "about"],
];

function sectionsOf(html: string): { preset: string; source: string }[] {
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  // Shopify: <div id="shopify-section-template--123__image_banner" class="shopify-section section">
  let found = [...body.matchAll(/id=["']shopify-section-template--[\w-]+__([a-z0-9_-]+?)(?:_[A-Za-z0-9]{6})?["']/gi)].map((m) => m[1].replace(/_[A-Za-z0-9]{6}$/, ""));
  if (!found.length) {
    // Other sites: the top-level sections' classes and ids, in order
    const main = body.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? body;
    found = [...main.matchAll(/<(?:section|div)\b[^>]*?(?:class|id)=["']([^"']{3,200})["']/gi)].map((m) => m[1].toLowerCase()).filter((c) => /section|block|hero|banner|slider|products|testimonial|faq|newsletter|gallery|features|collection|video/.test(c));
  }
  const out: { preset: string; source: string }[] = [];
  for (const name of found) {
    const hit = SECTION_MAP.find(([re]) => re.test(name.toLowerCase()));
    if (!hit || /^main|header|footer|announcement|cart|predictive|breadcrumb/.test(name)) continue;
    // The same kind twice in a row is one section (classes repeat on nested elements)
    if (out[out.length - 1]?.preset === hit[1]) continue;
    out.push({ preset: hit[1], source: name.replace(/[_-]+/g, " ").slice(0, 40) });
    if (out.length >= 12) break;
  }
  return out;
}

function platformOf(html: string): { platform: string; themeName?: string } {
  if (/cdn\.shopify\.com|Shopify\.theme/.test(html)) return { platform: "Shopify", themeName: html.match(/Shopify\.theme\s*=\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1] };
  if (/woocommerce/i.test(html)) return { platform: "WooCommerce" };
  if (/static\.wixstatic\.com|wix\.com/i.test(html)) return { platform: "Wix" };
  if (/squarespace/i.test(html)) return { platform: "Squarespace" };
  if (/webflow/i.test(html)) return { platform: "Webflow" };
  if (/framerusercontent|framer\.com/i.test(html)) return { platform: "Framer" };
  if (/bigcommerce/i.test(html)) return { platform: "BigCommerce" };
  return { platform: "Website" };
}

export async function readLook(input: string): Promise<CopiedLook> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new ImportError("That doesn't look like a web address.");
  }
  let html: string;
  try {
    const res = await safeFetch(url.toString(), { accept: HTML, maxBytes: 3_000_000 });
    if (res.status >= 400) throw new ImportError(`That site answered with an error (${res.status}). Check the address.`);
    html = res.text();
    url = new URL(res.url);
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(e instanceof FetchBlocked ? e.message : "We couldn't open that site. Check the address and try again.");
  }

  // The page's own styles, then its first few stylesheets from the same site or its CDN
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const styleAttrs = [...html.matchAll(/style=["']([^"']*--[^"']*)["']/gi)].map((m) => m[1]).join(";");
  const links = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)].map((m) => m[0].match(/href=["']([^"']+)["']/i)?.[1]).filter((h): h is string => !!h && !/fonts\.googleapis|font-awesome|cdnjs/.test(h)).slice(0, MAX_SHEETS);
  const sheets = await Promise.all(
    links.map(async (href) => {
      try {
        const u = new URL(href.replace(/&amp;/g, "&"), url);
        if (u.protocol !== "https:") return "";
        const r = await safeFetch(u.toString(), { accept: "text/css,*/*;q=0.1", maxBytes: 800_000, timeoutMs: 8000 });
        return r.status < 400 ? r.text() : "";
      } catch {
        return "";
      }
    })
  );
  const css = [inline, styleAttrs, ...sheets].join("\n");
  const vars = cssVars(css);

  const background = varColor(vars, ["--color-base-background-1", "--color-background", "--background", "--color-bg", "--bg-color", "--body-bg", "--color-body-background"]) ?? parseColor(css.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*([^;}\s]+)/i)?.[1] ?? "") ?? [255, 255, 255];
  const text = varColor(vars, ["--color-base-text", "--color-foreground", "--color-text", "--text-color", "--foreground", "--color-body-text"]) ?? parseColor(css.match(/body\s*\{[^}]*[^-]color\s*:\s*([^;}\s]+)/i)?.[1] ?? "") ?? (luminance(background) < 0.3 ? [240, 240, 240] : [18, 18, 18]);
  const theme = parseColor(html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)/i)?.[1] ?? "");
  const primary = varColor(vars, ["--color-base-accent-1", "--color-button", "--color-primary", "--primary", "--brand", "--color-brand", "--accent-color", "--color-accent"]) ?? (theme && saturation(theme) > 0.2 ? theme : undefined) ?? commonBrand(css) ?? text;
  const accent = varColor(vars, ["--color-base-accent-2", "--color-secondary", "--secondary", "--color-accent-2", "--accent"]);
  const buttonText = varColor(vars, ["--color-base-solid-button-labels", "--color-button-text", "--button-text-color"]) ?? (luminance(primary) > 0.45 ? [17, 17, 17] : [255, 255, 255]);
  const f = fonts(html, css, vars);
  const { platform, themeName } = platformOf(html);

  return {
    url: url.toString(),
    title: (html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? url.hostname).replace(/\s+/g, " ").trim().slice(0, 80),
    platform,
    themeName,
    colors: { background: hex(background), text: hex(text), primary: hex(primary), accent: accent ? hex(accent) : undefined, buttonText: hex(buttonText) },
    dark: luminance(background) < 0.2,
    fonts: f,
    fontPair: fontPair(f),
    corners: corners(css, vars),
    sections: sectionsOf(html),
  };
}
