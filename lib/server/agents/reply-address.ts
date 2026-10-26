import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Reply addresses for agent messages and reading a reply's own words. Kept apart from replies.ts
 * (server-only) so they can be unit tested, like the opt-out links.
 */

/* Reply addresses ------------------------------------------------------------------------------ */

function secret(env: Record<string, string | undefined> = process.env): string {
  const base = env.AGENTS_VAULT_KEY || env.INTEGRATIONS_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("No key to sign reply addresses with.");
  return `powerproof-agents-reply:${base}`;
}

const sign = (outboxId: string, env?: Record<string, string | undefined>) => createHmac("sha256", secret(env)).update(outboxId).digest("base64url").replace(/[-_]/g, "").slice(0, 20).toLowerCase();

/**
 * The reply address for one sent message, `reply+<outbox id>.<signature>@<domain>`, when inbound
 * email is set up (AGENT_REPLY_DOMAIN). Without it, replies go to the store's support email as before.
 */
export function replyAddress(outboxId: string, env: Record<string, string | undefined> = process.env): string | undefined {
  const domain = env.AGENT_REPLY_DOMAIN?.trim().toLowerCase();
  if (!domain) return undefined;
  return `reply+${outboxId}.${sign(outboxId, env)}@${domain}`;
}

/** The outbox id inside a reply address we signed, or null */
export function readReplyAddress(address: string, env?: Record<string, string | undefined>): string | null {
  const m = address.trim().toLowerCase().match(/^reply\+([0-9a-f-]{36})\.([a-z0-9]{20})@/);
  if (!m) return null;
  const want = Buffer.from(sign(m[1], env));
  const got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got) ? m[1] : null;
}

/** The reply's own words: quoted history, signatures and blank lines trimmed away */
export function replyText(text: string): string {
  const lines: string[] = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (/^>/.test(line) || /^On .+wrote:$/.test(line.trim()) || /^-{2,}\s*$/.test(line) || /^_{5,}/.test(line)) break;
    lines.push(line);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 500);
}
