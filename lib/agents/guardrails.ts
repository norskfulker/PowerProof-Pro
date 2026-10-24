/**
 * Checks on message wording, shared by the LLM gateway (on what the model wrote) and the editor
 * (on what the owner typed). The model writes wording only: placeholders carry every fact.
 */

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A forbidden phrase found as whole words, ignoring case ("fir" doesn't match "first") */
export function forbiddenPhraseIn(text: string, phrases: readonly string[]): string | null {
  const plain = text.replace(PLACEHOLDER, " ").toLowerCase();
  for (const p of phrases) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(p.toLowerCase()).replace(/\s+/g, "\\s+")}($|[^\\p{L}\\p{N}])`, "u");
    if (re.test(plain)) return p;
  }
  return null;
}

export type WordingProblem =
  | { code: "missing_placeholder"; placeholder: string }
  | { code: "unknown_placeholder"; placeholder: string }
  | { code: "has_digits" }
  | { code: "too_long"; max: number }
  | { code: "forbidden"; phrase: string }
  | { code: "empty" };

/**
 * Wording is fine when it keeps every required placeholder, invents none, holds no digits of its
 * own (amounts, dates and deadlines come only through placeholders), stays under the length
 * limit and uses no forbidden phrase.
 */
export function checkWording(text: string, o: { required: readonly string[]; allowed: readonly string[]; maxChars: number; forbidden: readonly string[] }): WordingProblem | null {
  if (!text.trim()) return { code: "empty" };
  const found = new Set(placeholdersIn(text));
  for (const r of o.required) {
    const name = r.replace(/[{}\s]/g, "");
    if (!found.has(name)) return { code: "missing_placeholder", placeholder: r };
  }
  const allowed = new Set(o.allowed.map((a) => a.replace(/[{}\s]/g, "")));
  for (const f of found) if (!allowed.has(f)) return { code: "unknown_placeholder", placeholder: `{{${f}}}` };
  if (/\d/.test(text.replace(PLACEHOLDER, ""))) return { code: "has_digits" };
  if (text.length > o.maxChars) return { code: "too_long", max: o.maxChars };
  const phrase = forbiddenPhraseIn(text, o.forbidden);
  if (phrase) return { code: "forbidden", phrase };
  return null;
}

export function describeProblem(p: WordingProblem): string {
  switch (p.code) {
    case "missing_placeholder":
      return `Keep ${p.placeholder} in the message.`;
    case "unknown_placeholder":
      return `${p.placeholder} isn't something the app can fill in.`;
    case "has_digits":
      return "Write amounts, dates and numbers only through the {{…}} fields.";
    case "too_long":
      return `Keep it under ${p.max} characters.`;
    case "forbidden":
      return `“${p.phrase}” isn't allowed in reminders.`;
    case "empty":
      return "The message is empty.";
  }
}

/** Puts the facts in. Values are inserted as plain text; a value can't introduce new placeholders. */
export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => (name in values ? values[name].replace(/\{\{|\}\}/g, "") : whole));
}
