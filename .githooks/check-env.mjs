// Refuses a commit that would put a readable secret in git: the .env.keys file, or an .env file
// with a value that isn't encrypted by dotenvx (.env.example may hold names with empty values).
import { execFileSync } from "node:child_process";

const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { encoding: "utf8" }).split("\n").filter(Boolean);
const problems = [];
for (const file of staged) {
  const name = file.split("/").pop();
  if (name === ".env.keys" || name.startsWith(".env.keys")) {
    problems.push(`${file}: this is the key that decrypts your secrets. Keep it out of git.`);
    continue;
  }
  if (!/^\.env(\.|$)/.test(name) && name !== ".dev.vars" && !name.startsWith(".dev.vars.")) continue;
  const text = execFileSync("git", ["show", `:${file}`], { encoding: "utf8" });
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    const value = raw.trim().replace(/^["']|["']$/g, "");
    if (!value || key.startsWith("DOTENV_PUBLIC_KEY") || value.startsWith("encrypted:")) continue;
    problems.push(`${file}:${i + 1}: ${key} isn't encrypted.`);
  }
}
if (problems.length) {
  console.error("Commit stopped: it would put secrets in git.\n  " + problems.join("\n  "));
  console.error("\nEncrypt with `npm run env:set -- NAME \"value\"` (or `npx dotenvx encrypt -f <file>`), or unstage the file.");
  process.exit(1);
}
