#!/usr/bin/env node
/**
 * One-time Cloudflare for SaaS setup for creators' custom domains (lib/server/cloudflare.ts).
 * Safe to run again: it only adds what's missing and reports the rest.
 *
 *   CF_SETUP_TOKEN=... CLOUDFLARE_ZONE_ID=... node scripts/setup-custom-domains.mjs [target]
 *
 * CF_SETUP_TOKEN needs "DNS: Edit" and "SSL and Certificates: Edit" on the zone (it is only used
 * here; the app's own CLOUDFLARE_API_TOKEN needs just "SSL and Certificates: Edit").
 * target defaults to customers.<zone>: the name creators point their CNAME at.
 *
 * It makes sure that:
 *   1. Cloudflare for SaaS answers on the zone (custom hostnames can be listed)
 *   2. <target> exists as a proxied, originless record (AAAA 100::) — the Worker is the origin
 *   3. <target> is the zone's fallback origin, and reports its status
 *   4. the zone's own name has a proxied record, so the `*\/*` Worker route (wrangler.jsonc) sees it
 * and prints the settings to add to the Worker.
 */
const token = process.env.CF_SETUP_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
if (!token || !zoneId) {
  console.error("Set CF_SETUP_TOKEN and CLOUDFLARE_ZONE_ID. See the comment at the top of this file.");
  process.exit(1);
}

async function cf(method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const err = json.errors?.[0];
    throw new Error(`${method} ${path || "/"} answered ${res.status}: ${err?.code ?? ""} ${err?.message ?? "no details"}`);
  }
  return json.result;
}

const ok = (msg) => console.log(`✓ ${msg}`);
const todo = (msg) => console.log(`! ${msg}`);

const zone = await cf("GET", "");
ok(`Zone ${zone.name} (${zone.status}, ${zone.plan?.name ?? "unknown plan"})`);
if (zone.status !== "active") todo(`The zone isn't active yet: point ${zone.name}'s nameservers to Cloudflare first.`);
const target = (process.argv[2] ?? `customers.${zone.name}`).toLowerCase();

try {
  await cf("GET", "/custom_hostnames?per_page=5");
  ok("Cloudflare for SaaS is on");
} catch (e) {
  todo(`Custom hostnames aren't available (${e.message}). Turn on Cloudflare for SaaS: dashboard › ${zone.name} › SSL/TLS › Custom Hostnames.`);
  process.exit(1);
}

const proxied = async (name) => (await cf("GET", `/dns_records?name=${encodeURIComponent(name)}`)).filter((r) => ["A", "AAAA", "CNAME"].includes(r.type));

const existing = await proxied(target);
if (!existing.length) {
  await cf("POST", "/dns_records", { type: "AAAA", name: target, content: "100::", proxied: true, ttl: 1, comment: "PowerProof custom domains: fallback origin (the Worker answers)" });
  ok(`Added ${target} AAAA 100:: (proxied)`);
} else if (existing.every((r) => r.proxied)) ok(`${target} already has a proxied record`);
else todo(`${target} has a record that isn't proxied: turn the orange cloud on for it.`);

let fallback = await cf("GET", "/custom_hostnames/fallback_origin").catch(() => null);
if (fallback?.origin !== target) {
  fallback = await cf("PUT", "/custom_hostnames/fallback_origin", { origin: target });
  ok(`Fallback origin set to ${target}`);
} else ok(`Fallback origin is ${target}`);
if (fallback?.status !== "active") todo(`Fallback origin status is "${fallback?.status}". It turns active within a few minutes; run this again to check.`);
else ok("Fallback origin is active");

const apex = await proxied(zone.name);
if (apex.some((r) => r.proxied)) ok(`${zone.name} has a proxied record (the Worker route will see it)`);
else todo(`${zone.name} has no proxied record. Add the Worker as a custom domain for ${zone.name} (Workers › powerproof-pro › Settings › Domains & Routes), or a proxied AAAA 100:: record.`);

console.log(`
Add these to the Worker (dashboard › Workers › powerproof-pro › Settings › Variables and Secrets):
  CLOUDFLARE_ZONE_ID       ${zoneId}
  CLOUDFLARE_CNAME_TARGET  ${target}
  CLOUDFLARE_API_TOKEN     (secret) a token with "SSL and Certificates: Edit" on ${zone.name}
  CRON_SECRET              (secret) any long random string, if it isn't set yet
Then deploy (npm run deploy) so the */* route in wrangler.jsonc is attached.`);
