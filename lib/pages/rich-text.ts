/**
 * The tiny, safe rich-text format used by text blocks: **bold**, _italic_ and [label](link).
 * Parsed into tokens (never HTML), so nothing a creator types can run as code.
 */
import { safeHref } from "./schema";

export type Inline = { kind: "text" | "bold" | "italic"; text: string } | { kind: "link"; text: string; href: string };

const PATTERN = /\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(PATTERN)) {
    if (m.index! > last) out.push({ kind: "text", text: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "italic", text: m[2] });
    else {
      const href = m[4];
      // Unsafe links stay as plain text
      if (safeHref.safeParse(href).success && href) out.push({ kind: "link", text: m[3], href });
      else out.push({ kind: "text", text: m[0] });
    }
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ kind: "text", text: src.slice(last) });
  return out;
}

/** Paragraphs are separated by a blank line. */
export function paragraphs(src: string): string[] {
  return src.split(/\n{2,}/).filter((p) => p.trim().length > 0);
}
