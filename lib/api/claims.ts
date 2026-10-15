import { sb } from "../supabase/browser";
import { ApiError } from "./client";
import { fail, must } from "./live/errors";
import { notifyChange } from "./live/local";
import { forgetMyStores, setActiveStore } from "./live/session";

/**
 * Handing a store to someone by email (migration 045): the owner transfers it, or PowerProof
 * staff send a claim link for a store they built. The database checks who may, that the store's
 * money is settled, and that the person signed in is the one it was sent to.
 */
export interface StoreClaim {
  id: string;
  email: string;
  kind: "transfer" | "claim";
  keepPrevious: boolean;
  note?: string;
  createdAt: string;
  expiresAt: string;
}

export interface ClaimInfo {
  storeName: string;
  storeSlug: string;
  logo?: string;
  brandColor?: string;
  from: string;
  email: string;
  kind: "transfer" | "claim";
  keepPrevious: boolean;
  note?: string;
  products: number;
  expired: boolean;
  blocker?: ClaimBlocker;
}

export type ClaimBlocker = "claim_balance" | "claim_payout" | "claim_cod" | "claim_dispute";

/** Why ownership can't move yet, in words */
export const BLOCKER_TEXT: Record<ClaimBlocker, string> = {
  claim_balance: "The store still has money in its balance. Withdraw it (or wait for pending sales to clear) first, so earnings go to the person who made them.",
  claim_payout: "A withdrawal is still on its way. Wait for it to arrive first.",
  claim_cod: "There are cash-on-delivery orders still to collect. Mark them collected or cancelled first.",
  claim_dispute: "A buyer's dispute is still open. Resolve it first.",
};

const REASONS: Record<string, string> = {
  claim_not_found: "This link isn't valid any more. It was used, cancelled or replaced by a newer one.",
  claim_expired: "This link has expired. Ask for a new one.",
  wrong_account: "You're logged in with a different email from the one this was sent to.",
  is_owner: "You already own this store.",
  plan_limit_stores: "Your plan doesn't include another store. Upgrade to Pro, then accept again.",
  ...BLOCKER_TEXT,
};

/** The open link for a store, if there is one (owner and staff only) */
export async function getStoreClaim(storeId: string): Promise<StoreClaim | null> {
  const r = await sb().from("store_claims").select("id, email, kind, keep_previous, note, created_at, expires_at").eq("store_id", storeId).eq("status", "pending").maybeSingle();
  if (r.error) fail(r.error);
  const c = r.data;
  return c ? { id: c.id, email: String(c.email), kind: c.kind === "claim" ? "claim" : "transfer", keepPrevious: c.keep_previous, note: c.note ?? undefined, createdAt: c.created_at, expiresAt: c.expires_at } : null;
}

/** Makes the link and emails it. The link comes back too, to share another way. */
export async function sendStoreClaim(input: { storeId: string; email: string; keepPrevious?: boolean; note?: string }): Promise<{ emailed: boolean; link: string; blocker?: ClaimBlocker }> {
  const res = await fetch("/api/claims", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }).catch(() => null);
  const out = (await res?.json().catch(() => null)) as { ok: boolean; message?: string; emailed?: boolean; link?: string; blocker?: ClaimBlocker | null } | null;
  if (!out?.ok) throw new ApiError(out?.message ?? "We couldn't reach PowerProof. Check your connection and try again.", "validation");
  notifyChange();
  return { emailed: !!out.emailed, link: out.link!, blocker: out.blocker ?? undefined };
}

export async function cancelStoreClaim(id: string): Promise<void> {
  const r = await sb().rpc("store_claim_cancel", { p_claim: id });
  if (r.error) fail(r.error);
  notifyChange();
}

/** What a link is for. Works before signing in. */
export async function getClaimInfo(token: string): Promise<ClaimInfo | null> {
  const r = await sb().rpc("store_claim_info", { p_token: token });
  if (r.error) fail(r.error);
  const v = r.data as Partial<ClaimInfo> & { logo?: string | null; note?: string | null; blocker?: ClaimBlocker | null } | null;
  if (!v?.storeName) return null;
  return {
    storeName: v.storeName,
    storeSlug: v.storeSlug ?? "",
    logo: v.logo ?? undefined,
    brandColor: v.brandColor ?? undefined,
    from: v.from ?? "The store owner",
    email: v.email ?? "",
    kind: v.kind === "claim" ? "claim" : "transfer",
    keepPrevious: !!v.keepPrevious,
    note: v.note ?? undefined,
    products: Number(v.products ?? 0),
    expired: !!v.expired,
    blocker: v.blocker ?? undefined,
  };
}

/** Takes the store over and makes it the active one */
export async function acceptClaim(token: string): Promise<string> {
  const r = await sb().rpc("store_claim_accept", { p_token: token });
  if (r.error) {
    const key = Object.keys(REASONS).find((k) => r.error!.message.includes(k));
    if (key) throw new ApiError(REASONS[key], "validation");
    fail(r.error);
  }
  const storeId = must(r) as string;
  forgetMyStores();
  setActiveStore(storeId);
  notifyChange();
  return storeId;
}
