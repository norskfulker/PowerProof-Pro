import "server-only";
import { sbServer } from "../supabase/server";

/** Who is asking, and are they PowerProof staff? Checked against the database, not just the browser. */
export async function currentAdmin(): Promise<{ id: string; email: string } | null> {
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: admin } = await db.rpc("is_admin");
  return admin ? { id: auth.user.id, email: auth.user.email ?? "" } : null;
}
