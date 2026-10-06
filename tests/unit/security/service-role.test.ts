import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The service-role key bypasses every RLS policy. It must only ever be read by server code, and it
 * must never end up in what the browser downloads.
 */

const ROOT = path.resolve(__dirname, "../../..");
const SKIP = new Set(["node_modules", ".next", ".git", "playwright-report", "test-results", "tests"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");
const sources = walk(ROOT).map((p) => ({ file: rel(p), text: fs.readFileSync(p, "utf8") }));

/** Server-only places: route handlers, the admin module itself, and server helpers. */
const serverOnly = (f: string) => /(^|\/)route\.ts$/.test(f) || f.startsWith("lib/server/") || f === "lib/supabase/admin.ts";

describe("service-role key", () => {
  it("is read in exactly one place, which is marked server-only", () => {
    const readers = sources.filter((s) => s.text.includes("SUPABASE_SERVICE_ROLE_KEY") && !s.file.endsWith(".md"));
    expect(readers.map((r) => r.file)).toEqual(["lib/supabase/admin.ts"]);
    expect(readers[0].text).toMatch(/^import "server-only";/m);
  });

  it("is only imported by server code, never by client components", () => {
    const importers = sources.filter(
      (s) => s.file !== "lib/supabase/admin.ts" && (/from ["'][^"']*\/supabase\/admin["']/.test(s.text) || (s.file.startsWith("lib/supabase/") && /from ["']\.\/admin["']/.test(s.text)))
    );
    for (const s of importers) {
      expect(serverOnly(s.file), `${s.file} imports the service-role client`).toBe(true);
      expect(s.text.includes('"use client"'), `${s.file} is a client component`).toBe(false);
    }
  });

  it("is not in the browser bundle (checked when a build exists)", () => {
    const dir = path.join(ROOT, ".next", "static");
    if (!fs.existsSync(dir)) return;
    const files: string[] = [];
    const scan = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? scan(path.join(d, e.name)) : e.name.endsWith(".js") && files.push(path.join(d, e.name))));
    scan(dir);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // A service-role JWT carries "role":"service_role" in its payload (base64: InJvbGUiOiJzZXJ2aWNlX3JvbGUi)
    const needles = ["SUPABASE_SERVICE_ROLE_KEY", "InJvbGUiOiJzZXJ2aWNlX3JvbGUi", ...(key && key.length > 20 ? [key] : [])];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      for (const n of needles) expect(text.includes(n), `${rel(f)} contains a service-role secret`).toBe(false);
    }
  });
});
