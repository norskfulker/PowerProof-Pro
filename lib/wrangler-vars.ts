import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The plain settings in wrangler.jsonc's "vars" are the one place they're written down: Cloudflare
 * applies them to the Worker on every deploy, and next.config.ts loads them into the build (so
 * NEXT_PUBLIC_* values get baked in) without a second copy in the dashboard's build variables.
 */

/** wrangler.jsonc as plain JSON: comments and trailing commas removed, strings left exactly as they are */
export function stripJsonc(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i < 0) break;
      i++;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

export function wranglerVars(dir = process.cwd()): Record<string, string> {
  try {
    const conf = JSON.parse(stripJsonc(readFileSync(join(dir, "wrangler.jsonc"), "utf8"))) as { vars?: Record<string, unknown> };
    return Object.fromEntries(Object.entries(conf.vars ?? {}).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Fills in what isn't set already, so .env.local (local dev) and any build variable still win */
export function loadWranglerVars(env: Record<string, string | undefined> = process.env, dir?: string): void {
  for (const [k, v] of Object.entries(wranglerVars(dir))) if (env[k] === undefined || env[k] === "") env[k] = v;
}
