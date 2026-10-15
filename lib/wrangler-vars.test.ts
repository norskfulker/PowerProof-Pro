import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWranglerVars, stripJsonc, wranglerVars } from "./wrangler-vars";

describe("wrangler vars", () => {
  it("strips comments and trailing commas but not // or /* inside strings", () => {
    const text = `/** top */ { "a": "https://x.app", // note\n "b": "*/*", /* c */ "c": [1,], }`;
    expect(JSON.parse(stripJsonc(text))).toEqual({ a: "https://x.app", b: "*/*", c: [1] });
  });

  it("reads the real wrangler.jsonc", () => {
    expect(wranglerVars().NEXT_PUBLIC_SITE_URL).toMatch(/^https:\/\//);
  });

  it("fills only what isn't set", () => {
    const dir = mkdtempSync(join(tmpdir(), "wv-"));
    writeFileSync(join(dir, "wrangler.jsonc"), `{ "vars": { "A": "from-file", "B": "from-file", "N": 1 } }`);
    const env: Record<string, string | undefined> = { A: "local", B: "" };
    loadWranglerVars(env, dir);
    expect(env).toEqual({ A: "local", B: "from-file" });
  });
});
