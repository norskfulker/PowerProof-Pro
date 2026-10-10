import { getSessionRaw, setSessionRaw } from "./local";
import { readProgress, writeProgress, type ProgressFlags } from "./flags";
import { THEME_EVENT, THEME_KEY } from "../../theme";
import { sb } from "../../supabase/browser";
import type { Session } from "../../types";
import { ALL_AREAS, type StoreAccess, type TeamArea } from "../../team";
import { ApiError } from "../client";

/**
 * The signed-in creator, as the app sees it. `getSession()` in the UI is synchronous, so the
 * session (name, email, active store) is cached in this browser and refreshed
 * from Supabase on sign-in and whenever the auth state changes.
 */

const ACTIVE = "pp:active-store";

function applySavedTheme(mode: "light" | "dark") {
  try {
    if (window.localStorage.getItem(THEME_KEY) === mode) return;
    window.localStorage.setItem(THEME_KEY, mode);
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    window.dispatchEvent(new Event(THEME_EVENT));
  } catch {
    /* storage blocked */
  }
}

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


let resolved: { user: string; id: string } | null = null;

/** A store the signed-in person can open: their own, or one whose team they joined */
export interface MyStore {
  id: string;
  name: string;
  slug: string;
  brandColor: string | null;
  createdAt: string;
  access: StoreAccess;
  /** The owner's plan: the store's Pro features follow it, whoever is working on it */
  ownerPlan: "free" | "pro";
}

let mine: { user: string; at: number; rows: Promise<MyStore[]> } | null = null;

/** Every store this person can open (owned first). Cached briefly so one screen asks once. */
export async function myStores(fresh = false): Promise<MyStore[]> {
  const user = await currentUser();
  if (!fresh && mine?.user === user.id && Date.now() - mine.at < 30_000) return mine.rows;
  const rows = (async () => {
    const r = await sb().rpc("my_stores");
    if (r.error) {
      mine = null;
      throw new ApiError("We couldn't load your stores. Refresh to try again.");
    }
    return (r.data ?? []).map((s): MyStore => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      brandColor: s.brand_color,
      createdAt: s.created_at,
      access: s.role === "owner" ? { role: "owner", areas: ALL_AREAS } : { role: s.role === "admin" ? "admin" : "member", areas: (s.areas ?? []).filter((a): a is TeamArea => (ALL_AREAS as string[]).includes(a)) },
      ownerPlan: s.owner_plan === "pro" ? "pro" : "free",
    }));
  })();
  mine = { user: user.id, at: Date.now(), rows };
  return rows;
}

/** Forget the cached list (after joining or leaving a team, or creating a store) */
export function forgetMyStores() {
  mine = null;
  resolved = null;
}

/**
 * The store the switcher has chosen, or the creator's first store. Always checked against the
 * database (once per signed-in user per page load), so a stale browser copy can never point at a
 * store that isn't theirs or no longer exists.
 */
export async function activeStoreId(): Promise<string> {
  const user = await currentUser();
  if (resolved?.user === user.id) return resolved.id;
  const rows = await myStores();
  if (!rows.length) throw new ApiError("Create your store first.", "not_found");
  const wanted = readActive() ?? getSessionRaw()?.storeId;
  const id = rows.find((r) => r.id === wanted)?.id ?? rows[0].id;
  rememberActive(id);
  const s = getSessionRaw();
  if (s && s.storeId !== id) setSessionRaw({ ...s, storeId: id });
  resolved = { user: user.id, id };
  return id;
}

export function setActiveStore(storeId: string) {
  resolved = null;
  mine = null;
  rememberActive(storeId);
  const s = getSessionRaw();
  if (s) setSessionRaw({ ...s, storeId });
}

/**
 * Loads the profile and stores after sign-in. A new account has no store yet: onboarding creates
 * the first one, and until then `storeId` is empty.
 */
export async function syncSession(): Promise<Session> {
  forgetMyStores();
  const user = await currentUser();
  const client = sb();
  const [{ data: profile }, list] = await Promise.all([
    client.from("profiles").select("full_name, email, onboarding").eq("id", user.id).maybeSingle(),
    myStores(true).catch(() => {
      throw new ApiError("We couldn't load your account. Refresh to try again.");
    }),
  ]);
  const name = profile?.full_name || user.name;
  const wanted = readActive();
  const storeId = list.find((s) => s.id === wanted)?.id ?? list[0]?.id ?? "";
  if (storeId) rememberActive(storeId);

  // Getting-started flags live in profiles.onboarding; the local copy keeps reads synchronous
  const saved = (profile?.onboarding ?? {}) as Partial<ProgressFlags>;
  writeProgress({ ...readProgress(user.email), ...saved, emailVerified: user.emailConfirmed }, user.email);
  // The colour mode they chose on another device
  if (saved.theme === "light" || saved.theme === "dark") applySavedTheme(saved.theme);

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
  resolved = null;
  mine = null;
  setSessionRaw(null);
  try {
    window.localStorage.removeItem(ACTIVE);
  } catch {
    /* private mode */
  }
}
