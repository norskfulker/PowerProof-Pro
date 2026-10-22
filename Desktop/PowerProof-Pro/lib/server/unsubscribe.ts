import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "../site-url";

/**
 * Unsubscribe links in store emails: signed, so nobody can unsubscribe someone else. The key is
 * UNSUBSCRIBE_SECRET, or the service key when that isn't set.
 */
function key(): string {
  const k = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("No key to sign unsubscribe links");
  return k;
}

const sign = (storeId: string, email: string) => createHmac("sha256", key()).update(`${storeId}:${email.toLowerCase()}`).digest("base64url");

export function unsubscribeUrl(storeId: string, email: string): string {
  const q = new URLSearchParams({ s: storeId, e: email.toLowerCase(), k: sign(storeId, email) });
  return `${siteUrl()}/api/unsubscribe?${q}`;
}

export function validUnsubscribe(storeId: string, email: string, sig: string): boolean {
  const want = Buffer.from(sign(storeId, email));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
