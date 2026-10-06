import { getSessionRaw, resetDb, db, setSessionRaw } from "../../mock/db";
import { readProgress, writeProgress, type ProgressFlags } from "../../mock/progress";
import { slugify } from "../../mock/random";
import { sb } from "../../supabase/browser";
import type { Session } from "../../types";
import { ApiError } from "../client";

/**
 * The signed-in creator, as the app sees it. `getSession()` in the UI is synchronous, so the
 * session (name, email, active store) is cached in the same place the mock kept it and refreshed
 * from Supabase on sign-in and whenever the auth state changes.
 */

const ACTIVE = "pp:active-store";

export interface LiveUser {
  id: string;
  email: string;
  name: string;
  emailConfirmed: boolean;
}

export async function currentUser(): Promise<LiveUser> {
  // getSession reads the local cookie (no network); RLS re-checks the JWT on every query
  const { data } = await sb().auth.getSession();
  const u = data.session?.user;
  if (!u) throw new ApiError("Your session has ended. Log in again.", "not_found");
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
  return { id: u.id, email: u.email ?? "", name: meta.full_name ?? meta.name ?? u.email?.split("@")[0] ?? "", emailConfirmed: Boolean(u.email_confirmed_at) };
}

function readActive(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE);
  } catch {
    return null;
  }
}

function rememberActive(storeId: string) {
  try {
    window.localStorage.setItem(ACTIVE, storeId);
  } catch {
    /* private mode */
  }
}

const isUuid = (v: string | undefined | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

/** The store the switcher has chosen, or the creator's first store. */
export async function activeStoreId(): Promise<string> {
  const cached = getSessionRaw()?.storeId;
  if (isUuid(cached)) return cached;
  return (await syncSession()).storeId;
}

export function setActiveStore(storeId: string) {
  rememberActive(storeId);
  const s = getSessionRaw();
  if (s) setSessionRaw({ ...s, storeId });
}

function newStoreSlug(name: string) {
  const base = (slugify(name) || "store").slice(0, 28);
  return `${base.length >= 3 ? base : `${base}-shop`}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Loads the profile and stores after sign-in. A new account gets its first (draft) store here,
 * so onboarding finds one to set up, as it always has. Also points the browser-only features
 * (media library, page builder, team …) at a clean local workspace for this account.
 */
export async function syncSession(): Promise<Session> {
  const user = await currentUser();
  const client = sb();
  const [{ data: profile }, { data: stores, error }] = await Promise.all([
    client.from("profiles").select("full_name, email, onboarding").eq("id", user.id).maybeSingle(),
    client.from("stores").select("id, name").eq("owner_id", user.id).order("created_at"),
  ]);
  if (error) throw new ApiError("We couldn't load your account. Refresh to try again.");
  const name = profile?.full_name || user.name;
  let list = stores ?? [];
  if (list.length === 0) {
    const first = name.trim().split(" ")[0] || "My";
    const { data: created, error: e } = await client
      .from("stores")
      .insert({ owner_id: user.id, name: `${first}'s Store`.slice(0, 80), slug: newStoreSlug(first), tagline: `Digital downloads by ${name}.`, support_email: user.email || null })
      .select("id, name")
      .single();
    if (e || !created) throw new ApiError("We couldn't set up your store. Refresh to try again.");
    list = [created];
  }
  const wanted = readActive();
  const storeId = list.find((s) => s.id === wanted)?.id ?? list[0].id;
  rememberActive(storeId);

  // Browser-only features keep their data in the local workspace: start it empty for this account
  const local = db();
  if (local.mode !== "fresh" || local.store.ownerEmail !== user.email.toLowerCase()) {
    resetDb("fresh", { ownerName: name, ownerEmail: user.email.toLowerCase(), name: list[0].name, supportEmail: user.email.toLowerCase() });
  }

  // Getting-started flags live in profiles.onboarding; the local copy keeps reads synchronous
  const saved = (profile?.onboarding ?? {}) as Partial<ProgressFlags>;
  writeProgress({ ...readProgress(user.email), ...saved, emailVerified: user.emailConfirmed }, user.email);

  const session: Session = { name, email: user.email.toLowerCase(), storeId };
  setSessionRaw(session);
  return session;
}

/** Saves getting-started flags to the profile. Called after each local change. */
export async function persistProgress(flags: ProgressFlags) {
  try {
    const user = await currentUser();
    await sb().from("profiles").update({ onboarding: JSON.parse(JSON.stringify(flags)) }).eq("id", user.id);
  } catch {
    /* signed out or offline: the next change saves everything again */
  }
}

export function clearSession() {
  setSessionRaw(null);
  try {
    window.localStorage.removeItem(ACTIVE);
  } catch {
    /* private mode */
  }
}
