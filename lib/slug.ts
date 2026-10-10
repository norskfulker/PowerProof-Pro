export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Logo letters, worked out from the store name: the first letter of the first two words. */
export function initialsOf(name: string): string {
  const letters = name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return letters || "PP";
}

/** Store names: letters (any script), marks, numbers, spaces and dashes; 2 to 74 characters. */
export const STORE_NAME_MIN = 2;
export const STORE_NAME_MAX = 74;
export const STORE_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} -]*$/u;

/** Trims and collapses repeated spaces. */
export const cleanStoreName = (name: string) => name.replace(/\s+/g, " ").trim();

/** An error message for a bad store name, or null when it's fine. */
export function storeNameError(raw: string): string | null {
  const n = cleanStoreName(raw);
  if (n.length < STORE_NAME_MIN) return "Give your store a name.";
  if (n.length > STORE_NAME_MAX) return `Keep it under ${STORE_NAME_MAX + 1} characters.`;
  if (!STORE_NAME_PATTERN.test(n)) return "Use letters, numbers, spaces and dashes only.";
  return null;
}
