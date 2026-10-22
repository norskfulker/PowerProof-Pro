import { sb } from "../supabase/browser";
import { ALL_AREAS, type StoreRole, type TeamArea } from "../team";
import { ApiError } from "./client";
import { liveChange } from "./live/notify";
import { fail } from "./live/errors";
import { activeStoreId, forgetMyStores, setActiveStore } from "./live/session";

/**
 * A store's team. Everything goes through the database's team_* functions, which check who is
 * asking: the owner and admins manage people, only the owner makes admins, anyone can leave.
 * Invites are sent by a server route (/api/team/invite) because sending email needs a secret key.
 */

export interface TeamPerson {
  /** null for the owner, who isn't a member row */
  id: string | null;
  email: string;
  name?: string;
  role: StoreRole;
  areas: TeamArea[];
  status: "active" | "invited";
  /** An invite whose link has run out */
  expired: boolean;
  invitedAt: string;
  expiresAt?: string;
  joinedAt?: string;
  lastSeenAt?: string;
  isYou: boolean;
}

export interface InviteReply {
  /** Whether the invite email went out (it doesn't when email isn't connected) */
  emailed: boolean;
  /** The accept link, to copy and send another way */
  link: string;
}

export interface InviteInfo {
  storeName: string;
  inviter: string;
  email: string;
  role: "admin" | "member";
  areas: TeamArea[];
  expired: boolean;
}

const areasOf = (a: string[] | null | undefined): TeamArea[] => (a ?? []).filter((x): x is TeamArea => (ALL_AREAS as string[]).includes(x));

/** The database's reasons, in words */
const REASONS: Record<string, string> = {
  not_allowed: "Only the store's owner and admins can manage the team.",
  owner_only: "Only the store's owner can make admins or change them.",
  no_areas: "Pick at least one part of the store they can work on.",
  bad_email: "That email looks off. Check for typos.",
  is_owner: "That's the store owner's own email.",
  already_member: "They're already on this store's team.",
  plan_limit_team: "Your plan's team seats are all used. Remove someone, or upgrade to Pro for more.",
  invite_not_found: "This invite link isn't valid any more. Ask for a new one.",
  invite_expired: "This invite has expired. Ask the store owner to send a new one.",
  wrong_account: "This invite is for a different email address. Log in with the email it was sent to.",
};

function teamFail(e: { message: string; code?: string } | null): never {
  const key = Object.keys(REASONS).find((k) => e?.message.includes(k));
  if (key) throw new ApiError(REASONS[key], key === "plan_limit_team" ? "limit" : "validation");
  fail(e as Parameters<typeof fail>[0]);
}

export async function getTeam(): Promise<TeamPerson[]> {
  const r = await sb().rpc("team_list", { p_store: await activeStoreId() });
  if (r.error) teamFail(r.error);
  return (r.data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name ?? undefined,
    role: p.role === "owner" ? "owner" : p.role === "admin" ? "admin" : "member",
    areas: areasOf(p.areas),
    status: p.status === "invited" ? "invited" : "active",
    expired: p.status === "invited" && !!p.expires_at && new Date(p.expires_at).getTime() < Date.now(),
    invitedAt: p.invited_at,
    expiresAt: p.expires_at ?? undefined,
    joinedAt: p.accepted_at ?? undefined,
    lastSeenAt: p.last_seen_at ?? undefined,
    isYou: !!p.is_you,
  }));
}

/** Invites someone (or sends a fresh link to someone already invited) */
export async function inviteTeamMember(input: { email: string; role: "admin" | "member"; areas: TeamArea[] }): Promise<InviteReply> {
  const res = await fetch("/api/team/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storeId: await activeStoreId(), ...input }),
  }).catch(() => undefined);
  if (!res) throw new ApiError("We couldn't reach PowerProof. Check your connection and try again.");
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; code?: string; emailed?: boolean; link?: string };
  if (!res.ok || !body.ok || !body.link) throw new ApiError(body.message ?? "The invite didn't go out. Try again.", body.code === "plan_limit_team" ? "limit" : "validation");
  return liveChange(Promise.resolve({ emailed: !!body.emailed, link: body.link }));
}

export async function updateTeamMember(id: string, role: "admin" | "member", areas: TeamArea[]): Promise<void> {
  const r = await sb().rpc("team_update", { p_member: id, p_role: role, p_areas: areas });
  if (r.error) teamFail(r.error);
  await liveChange(Promise.resolve());
}

/** Removes someone, cancels an invite, or (on your own row) leaves the store */
export async function removeTeamMember(id: string): Promise<void> {
  const r = await sb().rpc("team_remove", { p_member: id });
  if (r.error) teamFail(r.error);
  forgetMyStores();
  await liveChange(Promise.resolve());
}

/** The active store's member row for the signed-in person (to leave it) */
export async function myMembership(): Promise<{ id: string; role: StoreRole; areas: TeamArea[] } | null> {
  const storeId = await activeStoreId();
  const { data: auth } = await sb().auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return null;
  const r = await sb().from("store_members").select("id, role, areas").eq("store_id", storeId).eq("user_id", uid).maybeSingle();
  if (r.error) fail(r.error);
  return r.data ? { id: r.data.id, role: r.data.role === "admin" ? "admin" : "member", areas: areasOf(r.data.areas) } : null;
}

/** What an invite link is for. Works before signing in. */
export async function getInviteInfo(token: string): Promise<InviteInfo | null> {
  const r = await sb().rpc("team_invite_info", { p_token: token });
  if (r.error) fail(r.error);
  const v = r.data as { storeName?: string; inviter?: string; email?: string; role?: string; areas?: string[]; expired?: boolean } | null;
  if (!v?.storeName) return null;
  return { storeName: v.storeName, inviter: v.inviter ?? "The store owner", email: v.email ?? "", role: v.role === "admin" ? "admin" : "member", areas: areasOf(v.areas), expired: !!v.expired };
}

/** Joins the store and makes it the active one */
export async function acceptInvite(token: string): Promise<string> {
  const r = await sb().rpc("team_accept", { p_token: token });
  if (r.error) teamFail(r.error);
  const storeId = r.data as string;
  forgetMyStores();
  setActiveStore(storeId);
  return liveChange(Promise.resolve(storeId));
}
