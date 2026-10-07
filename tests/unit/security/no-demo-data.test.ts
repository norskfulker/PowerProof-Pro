import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guards for "no demo data in the product": app code never imports test fixtures, never reads a
 * mock backend, and has no switch to turn one on.
 */

const ROOT = path.resolve(__dirname, "../../..");
const APP_DIRS = ["app", "components", "hooks", "lib", "emails"];
const FILES = ["proxy.ts"];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");
const appFiles = [...APP_DIRS.flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : [])), ...FILES.map((f) => path.join(ROOT, f))].map((p) => ({ file: rel(p), text: fs.readFileSync(p, "utf8") }));

const importsOf = (text: string) => [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

describe("app code and test fixtures", () => {
  it("scans a meaningful number of files", () => {
    expect(appFiles.length).toBeGreaterThan(100);
  });

  it("never imports from tests/ or a fixtures folder", () => {
    const bad = appFiles.flatMap((f) => importsOf(f.text).filter((i) => /(^|\/)tests(\/|$)|(^|\/)fixtures(\/|$)/.test(i)).map((i) => `${f.file} imports ${i}`));
    expect(bad).toEqual([]);
  });
});

describe("no mock backend", () => {
  it("has no lib/mock folder", () => {
    expect(fs.existsSync(path.join(ROOT, "lib/mock"))).toBe(false);
  });

  it("has no backend switch or mock/demo imports in app code", () => {
    const bad = appFiles.flatMap((f) => {
      const hits: string[] = [];
      if (/NEXT_PUBLIC_BACKEND/.test(f.text)) hits.push(`${f.file} reads NEXT_PUBLIC_BACKEND`);
      if (/\bisLive\b/.test(f.text)) hits.push(`${f.file} uses isLive`);
      for (const i of importsOf(f.text)) if (/(^|\/)mock(\/|$)/.test(i)) hits.push(`${f.file} imports ${i}`);
      return hits;
    });
    expect(bad).toEqual([]);
  });

  it("keeps no demo controls or seed switches in the UI", () => {
    const bad = appFiles.filter((f) => /pp:demo|pp:seed|Load sample data|Demo data|loadStressData|startEmptyStore/.test(f.text)).map((f) => f.file);
    expect(bad).toEqual([]);
  });
});
