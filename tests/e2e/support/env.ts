import fs from "node:fs";

let loaded = false;

/** Reads .env.local and .env.test.local (already-set variables win). */
export function loadTestEnv() {
  if (loaded) return;
  loaded = true;
  for (const f of [".env.test.local", ".env.local"]) if (fs.existsSync(f)) process.loadEnvFile(f);
}

export function need(name: string): string {
  loadTestEnv();
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to .env.test.local (see .env.example). The tests run against the real database with the two test creators; there is no mock to fall back to.`);
  return v;
}

export const optional = (name: string) => {
  loadTestEnv();
  return process.env[name] || undefined;
};
