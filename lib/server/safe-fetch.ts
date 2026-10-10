import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetching addresses a creator typed (their website, image links): https only, never a private or
 * internal address (checked again at every redirect), with a size cap and a timeout. Keeps the
 * server from being used to reach things it shouldn't.
 */
export class FetchBlocked extends Error {}

const V4_BLOCKED: [number, number][] = [
  [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8], [0xa9fe0000, 16], [0xac100000, 12],
  [0xc0000000, 24], [0xc0000200, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24], [0xcb007100, 24], [0xe0000000, 4], [0xf0000000, 4],
];

function v4Blocked(ip: string): boolean {
  const n = ip.split(".").reduce((t, o) => (t << 8) + Number(o), 0) >>> 0;
  return V4_BLOCKED.some(([net, bits]) => (n >>> (32 - bits)) === (net >>> (32 - bits)));
}

export function addressBlocked(ip: string): boolean {
  if (isIP(ip) === 4) return v4Blocked(ip);
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Blocked(mapped[1]);
  return v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6) || v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8");
}

async function checkHost(url: URL) {
  if (url.protocol !== "https:") throw new FetchBlocked("Only https:// addresses can be read.");
  if (url.username || url.password) throw new FetchBlocked("That address can't be read.");
  if (url.port && url.port !== "443") throw new FetchBlocked("That address can't be read.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new FetchBlocked("That address can't be read.");
  const ips = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!ips.length) throw new FetchBlocked(`We couldn't find ${host}. Check the address.`);
  if (ips.some((a) => addressBlocked(a.address))) throw new FetchBlocked("That address can't be read.");
}

export interface SafeResponse {
  status: number;
  url: string;
  headers: Headers;
  bytes: Uint8Array;
  text: () => string;
}

/** GET (or the given method) with redirects followed by hand and checked */
export async function safeFetch(input: string, opts: { maxBytes?: number; timeoutMs?: number; headers?: Record<string, string>; method?: string; body?: string; accept?: string } = {}): Promise<SafeResponse> {
  const maxBytes = opts.maxBytes ?? 3_000_000;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 12_000);
  let url = new URL(input);
  for (let hop = 0; hop < 5; hop++) {
    await checkHost(url);
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      body: opts.body,
      redirect: "manual",
      signal,
      headers: { "user-agent": "PowerProofImporter/1.0 (+https://powerproof.app)", accept: opts.accept ?? "*/*", ...opts.headers },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new FetchBlocked("That's too big to read.");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          throw new FetchBlocked("That's too big to read.");
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.length;
    }
    return { status: res.status, url: url.toString(), headers: res.headers, bytes, text: () => new TextDecoder().decode(bytes) };
  }
  throw new FetchBlocked("That address redirects too many times.");
}

/** JSON from a safe fetch, or undefined when it isn't JSON (or isn't a 200) */
export async function safeJson<T>(input: string, opts: Parameters<typeof safeFetch>[1] = {}): Promise<{ status: number; data?: T; headers: Headers }> {
  const r = await safeFetch(input, { accept: "application/json", ...opts });
  if (r.status !== 200) return { status: r.status, headers: r.headers };
  try {
    return { status: r.status, data: JSON.parse(r.text()) as T, headers: r.headers };
  } catch {
    return { status: r.status, headers: r.headers };
  }
}
