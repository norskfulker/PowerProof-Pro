import { slugify } from "./slug";

/** A slug from a title, unique among `taken`: "hello-world", "hello-world-2", … */
export function uniqueSlug(title: string, taken: Iterable<string>, fallback = "post"): string {
  const base = slugify(title) || fallback;
  const owned = new Set(taken);
  if (!owned.has(base)) return base;
  let n = 2;
  while (owned.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** The first words of a body, for the card and search description when no excerpt is set. */
export function excerptOf(body: string, max = 160): string {
  const clean = body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}
