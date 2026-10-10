// The encrypted settings in .env.local (dotenvx), on any computer.
//
//   node scripts/env.mjs check   run before dev/build/start: can this computer read .env.local?
//                                Says exactly what to do when it can't, instead of starting the app
//                                with scrambled settings.
//   node scripts/env.mjs key     saves the key that unlocks .env.local into .env.keys (asks for it,
//                                or takes it as an argument), in a form dotenvx can read on Windows,
//                                macOS and Linux alike.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

const ENV = ".env.local";
const KEYS = ".env.keys";
const NAME = "DOTENV_PRIVATE_KEY_LOCAL";
const require = createRequire(import.meta.url);
// dotenvx's command line, next to its main file (the package doesn't export the path itself)
const cli = join(dirname(require.resolve("@dotenvx/dotenvx")), "..", "cli", "dotenvx.js");

const say = (s) => console.error(s);
const win = process.platform === "win32";

/** .env.keys as text, whatever editor or shell wrote it (PowerShell's `>` writes UTF-16) */
function readKeys() {
  const buf = readFileSync(KEYS);
  if (buf[0] === 0xff && buf[1] === 0xfe) return { text: buf.subarray(2).toString("utf16le"), rewrite: true };
  if (buf[0] === 0xfe && buf[1] === 0xff) return { text: Buffer.from(buf.subarray(2)).swap16().toString("utf16le"), rewrite: true };
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { text: buf.subarray(3).toString("utf8"), rewrite: true };
  // UTF-16 without a byte order mark: every other byte is zero
  if (buf.length > 4 && buf[1] === 0 && buf[3] === 0) return { text: buf.toString("utf16le"), rewrite: true };
  return { text: buf.toString("utf8"), rewrite: false };
}

function writeKeys(key) {
  writeFileSync(
    KEYS,
    `#/------------------!DOTENV_PRIVATE_KEYS!-------------------/\n#/ private decryption keys. DO NOT commit to source control /\n#/   copy this key to each computer: npm run env:key        /\n#/----------------------------------------------------------/\n\n# ${ENV}\n${NAME}=${key}\n`,
    { encoding: "utf8", mode: 0o600 }
  );
}

/** The key, from anything someone might paste: the bare 64 characters, or the whole line */
const keyFrom = (s) => s.match(/(?:^|[^0-9a-f])([0-9a-f]{64})(?![0-9a-f])/i)?.[1]?.toLowerCase();

/** Whether dotenvx can decrypt .env.local here (asks for one value) */
function canDecrypt() {
  const first = readFileSync(ENV, "utf8").match(/^([A-Za-z_][A-Za-z0-9_]*)="?encrypted:/m)?.[1];
  if (!first) return true;
  try {
    const out = execFileSync(process.execPath, [cli, "get", first, "-f", ENV], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    return !!out && !out.startsWith("encrypted:");
  } catch {
    return false;
  }
}

function help() {
  say(`
  To fix it, give this computer the key (it's the ${NAME}=... line in .env.keys on a computer
  where the app already runs, or wherever you saved it, like your password manager). Run:

      npm run env:key

  and paste the key when asked. Don't create .env.keys with ${win ? "PowerShell's echo or >" : "a shell redirect"}: ${win ? "that saves it in a format dotenvx can't read." : "use the command above so it's saved correctly."}
`);
}

function check() {
  if (!existsSync(ENV)) return; // nothing to decrypt; the app says which settings are missing
  if (existsSync(KEYS)) {
    const { text, rewrite } = readKeys();
    const key = keyFrom(text);
    if (rewrite && key) {
      writeKeys(key);
      say(`✓ ${KEYS} was saved in a format dotenvx can't read (UTF-16, as PowerShell writes it). Saved it again as plain text.`);
    }
  }
  if (canDecrypt()) return;
  const envVar = process.env[NAME] || process.env.DOTENV_PRIVATE_KEY;
  say(`\n✗ This computer can't unlock the settings in ${ENV}.`);
  if (envVar) say(`\n  ${process.env[NAME] ? NAME : "DOTENV_PRIVATE_KEY"} is set in this terminal's environment, but it isn't the right key. Remove it${win ? ` (PowerShell: Remove-Item Env:${process.env[NAME] ? NAME : "DOTENV_PRIVATE_KEY"})` : ""}, or set the right one.`);
  else if (!existsSync(KEYS)) say(`\n  There's no ${KEYS} file in this folder yet.`);
  else say(`\n  ${KEYS} is here, but the key in it doesn't unlock ${ENV}. It may be cut short, or from another copy of the project.`);
  help();
  process.exit(1);
}

async function key() {
  let input = process.argv.slice(3).join(" ");
  if (!input) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    input = await new Promise((resolve) => rl.question(`Paste the key (the ${NAME}=... line, or just the 64 characters after =): `, (a) => (rl.close(), resolve(a))));
  }
  const k = keyFrom(input);
  if (!k) {
    say(`✗ That doesn't look like the key. It's 64 letters and numbers (0-9, a-f), found after ${NAME}= in .env.keys.`);
    process.exit(1);
  }
  writeKeys(k);
  if (existsSync(ENV) && !canDecrypt()) {
    say(`✗ Saved ${KEYS}, but that key doesn't unlock ${ENV}. Check you copied the key from this project.`);
    process.exit(1);
  }
  say(`✓ Saved ${KEYS}. This computer can read the settings now: npm run dev`);
}

const cmd = process.argv[2];
if (cmd === "check") check();
else if (cmd === "key") await key();
else {
  say("Use: node scripts/env.mjs check | key");
  process.exit(1);
}
