import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Opt-out links and hashes. A link names a message (its outbox id) and is signed, so it reveals no
 * address and can't be forged for someone else. Opt-outs are stored as a hash of the address
 * (lowercase email or E.164 phone) per store and channel.
 */

function secret(env: Record<string, string | undefined> = process.env): string {
  const base = env.AGENTS_VAULT_KEY || env.INTEGRATIONS_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("No key to sign opt-out links with.");
  return `powerproof-agents-optout:${base}`;
}

export function addressHash(channel: "email" | "sms" | "whatsapp", address: string): string {
  const a = channel === "email" ? address.trim().toLowerCase() : address.trim();
  return createHash("sha256").update(a, "utf8").digest("hex");
}

export function optOutToken(outboxId: string, env?: Record<string, string | undefined>): string {
  const sig = createHmac("sha256", secret(env)).update(outboxId).digest("base64url").slice(0, 32);
  return `${outboxId}.${sig}`;
}

/** The outbox id inside a valid token, or null */
export function readOptOutToken(token: string, env?: Record<string, string | undefined>): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const want = Buffer.from(optOutToken(id, env).split(".")[1]);
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}
