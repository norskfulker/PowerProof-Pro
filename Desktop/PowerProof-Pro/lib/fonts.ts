import type { CustomFont } from "./types";

/**
 * A store's own font: uploaded once, served from the public store-media bucket and loaded with
 * @font-face wherever the store's theme is applied. Only real font files are accepted.
 */
export const FONT_MAX_BYTES = 2 * 1024 * 1024;
export const FONT_FAMILY = "PPCustomFont";

const FORMATS = {
  woff2: { mime: "font/woff2", format: "woff2" },
  woff: { mime: "font/woff", format: "woff" },
  ttf: { mime: "font/ttf", format: "truetype" },
  otf: { mime: "font/otf", format: "opentype" },
} as const;
export type FontExt = keyof typeof FORMATS;

export const FONT_ACCEPT = ".woff2,.woff,.ttf,.otf";

export const fontExt = (name: string): FontExt | undefined => {
  const e = name.toLowerCase().split(".").pop() as FontExt;
  return e in FORMATS ? e : undefined;
};
export const fontFormat = (ext: FontExt): CustomFont["format"] => FORMATS[ext].format;
export const fontMime = (ext: FontExt) => FORMATS[ext].mime;

/** The file's first bytes say what it really is: a renamed image or script isn't a font. */
export function looksLikeFont(head: Uint8Array, ext: FontExt): boolean {
  const tag = String.fromCharCode(...head.slice(0, 4));
  if (ext === "woff2") return tag === "wOF2";
  if (ext === "woff") return tag === "wOFF";
  if (ext === "otf") return tag === "OTTO" || (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0);
  return (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) || tag === "true";
}

/** Why a file can't be used as a font, or null when it can (the bytes are checked separately). */
export function fontFileError(file: { name: string; size: number }): string | null {
  if (!fontExt(file.name)) return "Use a .woff2, .woff, .ttf or .otf font file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > FONT_MAX_BYTES) return "Fonts can be up to 2 MB. A .woff2 file is usually much smaller.";
  return null;
}

/** A name to show for the font: the file name without its extension. */
export const fontLabel = (fileName: string) => fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/[^\w ().]/g, "").trim().slice(0, 40) || "Custom font";

/** Only our own storage or any https address, with nothing that could break out of a CSS url(). */
const SAFE_URL = /^https:\/\/[\w.~:/?#@!$&*+,=%-]+$/;
export const isSafeFontUrl = (u: string) => SAFE_URL.test(u);

/** The @font-face rule for a store's font, or "" when there isn't a usable one. */
export function fontFaceCss(font: CustomFont | undefined): string {
  if (!font || !isSafeFontUrl(font.src) || !["woff2", "woff", "truetype", "opentype"].includes(font.format)) return "";
  return `@font-face{font-family:"${FONT_FAMILY}";src:url("${font.src}") format("${font.format}");font-weight:100 900;font-style:normal;font-display:swap}`;
}
