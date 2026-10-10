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
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data, error } = await sb.rpc("my_stores");
  if (error) throw new Error("We couldn't check your store. Refresh to try again.");
  return (data ?? []).length > 0;
}

/** Creator screens render only once a store exists; until then everything goes to /onboarding. */
export async function requireStore() {
  if (!(await hasStore())) redirect("/onboarding");
}

/** /onboarding is only for creators without a store. */
export async function requireNoStore() {
  if (await hasStore()) redirect("/dashboard");
}
