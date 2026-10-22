// Refuses a commit that would put a readable secret in git: .env.keys, .dev.vars, any
// .env file with a value in it (.env.example may only hold names with empty values).
import { execFileSync } from "node:child_process";

const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { encoding: "utf8" }).split("\n").filter(Boolean);
const problems = [];
for (const file of staged) {
  const name = file.split("/").pop();
  if (name === ".env.keys" || name.startsWith(".env.keys")) {
    problems.push(`${file}: this is a private key. Keep it out of git.`);
    continue;
  }
  if (!/^\.env(\.|$)/.test(name) && name !== ".dev.vars" && !name.startsWith(".dev.vars.")) continue;
  const text = execFileSync("git", ["show", `:${file}`], { encoding: "utf8" });
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    const value = raw.trim().replace(/^["']|["']$/g, "");
    if (!value) continue;
    problems.push(`${file}:${i + 1}: ${key} has a value. Only .env.example (names, no values) may be committed.`);
  }
}
if (problems.length) {
  console.error("Commit stopped: it would put secrets in git.\n  " + problems.join("\n  "));
  console.error("\nUnstage the file, or move the value to your gitignored .env.local.");
  process.exit(1);
}
