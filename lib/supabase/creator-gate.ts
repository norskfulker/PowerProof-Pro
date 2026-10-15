import "server-only";
import { redirect } from "next/navigation";
import { sbServer } from "./server";

/**
 * Whether the signed-in creator has at least one store (any status): their own, or one whose team
 * they joined. Checked on the server from the database, so it holds on every device and browser.
 * A failed lookup throws (error page) instead of redirecting, so a hiccup can never trap anyone in
 * a redirect loop.
 */
async function hasStore(): Promise<boolean> {
  const sb = await sbServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  // A failed lookup throws instead of redirecting: the proxy checks the session locally while
  // this call reaches the Auth API, so sending failures to /login could bounce against the
  // proxy's verdict forever. Signed-out (no error, no user) still goes to /login.
  if (authError) {
    console.error(`[creator-gate] getUser failed: ${authError.message}`);
    throw new Error("We couldn't check your session. Refresh to try again.");
  }
  if (!auth.user) redirect("/login");
  const { data, error } = await sb.rpc("my_stores");
  if (error) throw new Error("We couldn't check your store. Refresh to try again.");
  return (data ?? []).length > 0;
}

/** Creator screens render only once a store exists; until then everything goes to /onboarding. */
export async function requireStore() {
  if (!(await hasStore())) redirect("/onboarding");
}

/** The store being set up, while it hasn't opened to buyers yet (so the setup can still be switched) */
export interface SetupStore {
  id: string;
  name: string;
  slug: string;
  brandColor: string;
  setupMode: "ai" | "manual";
}

/**
 * /onboarding is for creators without a store, and for an owner whose only store hasn't opened
 * yet: until it first opens they may switch between setting it up with AI and by hand. Everyone
 * else goes to the dashboard. Returns the unopened store, or null when there is none yet.
 */
export async function requireSetupOpen(): Promise<SetupStore | null> {
  if (!(await hasStore())) return null;
  const sb = await sbServer();
  const { data: auth } = await sb.auth.getUser();
  const { data: mine } = await sb.rpc("my_stores");
  const only = mine?.length === 1 && mine[0].role === "owner" ? mine[0] : null;
  if (!only) redirect("/dashboard");
  const { data: row } = await sb.from("stores").select("id, name, slug, brand_color, owner_id, status, setup_mode, first_opened_at").eq("id", only.id).maybeSingle();
  // Opened (or the setup columns aren't there yet): the setup is settled
  if (!row || row.owner_id !== auth.user?.id || row.first_opened_at || row.status !== "draft") redirect("/dashboard");
  return { id: row.id, name: row.name, slug: row.slug, brandColor: row.brand_color ?? "#0F3D33", setupMode: row.setup_mode === "ai" ? "ai" : "manual" };
}
