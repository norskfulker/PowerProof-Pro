#!/usr/bin/env node
/**
 * Keeps .env.local the same on every machine without ever putting a readable secret in git.
 *
 *   node scripts/env-sync.mjs push   encrypt .env.local → secrets/env.local.enc, commit it, git push
 *   node scripts/env-sync.mjs pull   git pull, then decrypt secrets/env.local.enc → .env.local
 *   node scripts/env-sync.mjs status show whether this machine's .env.local matches the synced copy
 *
 * Encryption: AES-256-GCM with a random 32-byte key kept OUTSIDE the repo, at
 * ~/.powerproof/env.key (or in POWERPROOF_ENV_KEY). The first push on a machine with no key makes
 * one. Copy that key file to each of your other machines once; after that, keys sync through git.
 * Lose the key and the encrypted file can't be opened (make a new key and push again).
 * The previous .env.local is kept as .env.local.bak (gitignored) whenever pull replaces it.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLAIN = join(ROOT, ".env.local");
const BACKUP = join(ROOT, ".env.local.bak");
const SEALED = join(ROOT, "secrets", "env.local.enc");
const SEALED_REL = "secrets/env.local.enc";
const KEY_FILE = join(homedir(), ".powerproof", "env.key");

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const fail = (msg) => {
  console.error(`\n${msg}\n`);
  process.exit(1);
};

function loadKey({ create }) {
  const fromEnv = process.env.POWERPROOF_ENV_KEY?.trim();
  const raw = fromEnv || (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, "utf8").trim() : "");
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) fail(`The key in ${fromEnv ? "POWERPROOF_ENV_KEY" : KEY_FILE} isn't valid (it should be 44 characters).`);
    return key;
  }
  if (!create) fail(`No key on this machine. Copy ${KEY_FILE} from a machine that has it (same path here), then run this again.`);
  const key = randomBytes(32);
  mkdirSync(dirname(KEY_FILE), { recursive: true });
  writeFileSync(KEY_FILE, key.toString("base64") + "\n", { mode: 0o600 });
  console.log(`Made a new key at ${KEY_FILE}.\nCopy this file to the same place on your other machines (once). Never put it in git or chat.`);
  return key;
}

const fingerprint = (key) => createHash("sha256").update(key).digest("hex").slice(0, 8);

function seal(text, key) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return JSON.stringify({ v: 1, key: fingerprint(key), at: new Date().toISOString(), from: hostname(), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") }, null, 2) + "\n";
}

function open(sealedText, key) {
  const s = JSON.parse(sealedText);
  if (s.v !== 1) fail("secrets/env.local.enc is in a format this script doesn't know.");
  if (s.key !== fingerprint(key)) fail(`This machine's key (${fingerprint(key)}) isn't the one the file was locked with (${s.key}). Copy the right ${KEY_FILE} from your other machine.`);
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(s.iv, "base64"));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  try {
    return { text: Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8"), at: s.at, from: s.from };
  } catch {
    fail("secrets/env.local.enc couldn't be opened: it was changed, or locked with another key.");
  }
}

/** Names only, never values: what pull would add, change or drop */
function diffNames(oldText, newText) {
  const parse = (t) => new Map(t.split(/\r?\n/).map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
  const a = parse(oldText);
  const b = parse(newText);
  return {
    added: [...b.keys()].filter((k) => !a.has(k)),
    changed: [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k)),
    removed: [...a.keys()].filter((k) => !b.has(k)),
  };
}

function push() {
  if (!existsSync(PLAIN)) fail("There's no .env.local here to push.");
  const text = readFileSync(PLAIN, "utf8");
  if (/^NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|PRIVATE)/m.test(text)) fail("Refusing: a NEXT_PUBLIC_ name holds a secret (it would be built into the website). Rename it first.");
  const key = loadKey({ create: true });
  if (existsSync(SEALED)) {
    const current = open(readFileSync(SEALED, "utf8"), key);
    if (current.text === text) return console.log("Already up to date: the synced copy matches this .env.local.");
  }
  mkdirSync(dirname(SEALED), { recursive: true });
  writeFileSync(SEALED, seal(text, key));
  git("add", SEALED_REL);
  git("commit", "-m", `Update encrypted .env.local (from ${hostname()})`, "--", SEALED_REL);
  try {
    git("push");
  } catch (e) {
    fail(`Committed locally, but the push failed. Run "git pull --rebase" then "git push".\n${String(e.stderr ?? e.message).slice(0, 400)}`);
  }
  console.log(`Pushed. Run "node scripts/env-sync.mjs pull" on your other machines.`);
}

function pull() {
  try {
    git("pull", "--ff-only");
  } catch (e) {
    fail(`git pull didn't go through (local changes or a diverged branch). Sort that out, then run this again.\n${String(e.stderr ?? e.message).slice(0, 400)}`);
  }
  if (!existsSync(SEALED)) fail("There's no synced copy yet. Run push on the machine that has the right .env.local.");
  const key = loadKey({ create: false });
  const { text, at, from } = open(readFileSync(SEALED, "utf8"), key);
  const old = existsSync(PLAIN) ? readFileSync(PLAIN, "utf8") : "";
  if (old === text) return console.log(`Already up to date (synced copy from ${from}, ${at}).`);
  if (old) writeFileSync(BACKUP, old, { mode: 0o600 });
  writeFileSync(PLAIN, text, { mode: 0o600 });
  const d = diffNames(old, text);
  console.log(`Updated .env.local from ${from} (${at}).`);
  for (const [label, names] of Object.entries(d)) if (names.length) console.log(`  ${label}: ${names.join(", ")}`);
  if (old) console.log("  Your previous copy is in .env.local.bak.");
  console.log("Restart npm run dev to use it.");
}

function status() {
  const key = loadKey({ create: false });
  if (!existsSync(SEALED)) return console.log("Nothing synced yet.");
  const { text, at, from } = open(readFileSync(SEALED, "utf8"), key);
  const local = existsSync(PLAIN) ? readFileSync(PLAIN, "utf8") : "";
  if (local === text) return console.log(`In sync (synced copy from ${from}, ${at}).`);
  const d = diffNames(text, local);
  console.log(`This .env.local differs from the synced copy (from ${from}, ${at}).`);
  for (const [label, names] of Object.entries({ "only here": d.added, "different here": d.changed, "missing here": d.removed })) if (names.length) console.log(`  ${label}: ${names.join(", ")}`);
  console.log('Run "push" to share this machine\'s version, or "pull" to take the synced one.');
}

const cmd = process.argv[2];
if (cmd === "push") push();
else if (cmd === "pull") pull();
else if (cmd === "status") status();
else fail("Use: node scripts/env-sync.mjs push | pull | status");
