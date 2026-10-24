import "server-only";
import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/server/admin-auth";
import { agentsAdmin, agentsAsUser, NotConfiguredError } from "./db";

/**
 * Who may do what, checked on the server against the database before any service-role write:
 * a store's agents are for its owner and team admins (store_can(store, 'agents')); billing is the
 * owner's; Admin pages are staff (is_admin()). Every admin change is written to agent_audit_log.
 */

export class AgentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function requireUser(): Promise<{ id: string; email: string }> {
  const sb = await agentsAsUser();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new AgentError("Log in again.", 401);
  return { id: data.user.id, email: data.user.email ?? "" };
}

/** The signed-in person can work on this store's agents */
export async function requireStoreAgents(storeId: string): Promise<{ id: string; email: string }> {
  const user = await requireUser();
  const sb = await agentsAsUser();
  const { data, error } = await sb.rpc("store_can", { p_store: storeId, p_area: "agents" });
  if (error || data !== true) throw new AgentError("This part of the store isn't in your access.", 403);
  return user;
}

/** The instance, after checking the caller may work on its store */
export async function requireInstance(instanceId: string): Promise<{ user: { id: string; email: string }; storeId: string; agentId: string }> {
  const { data } = await agentsAdmin().from("agent_instances").select("store_id, agent_id").eq("id", instanceId).maybeSingle();
  if (!data) throw new AgentError("That agent wasn't found.", 404);
  const user = await requireStoreAgents(data.store_id as string);
  return { user, storeId: data.store_id as string, agentId: data.agent_id as string };
}

export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const admin = await currentAdmin();
  if (!admin) throw new AgentError("Staff only.", 403);
  return admin;
}

export async function audit(actorId: string | null, action: string, target: { type: string; id: string }, meta: Record<string, unknown> = {}) {
  await agentsAdmin().from("agent_audit_log").insert({ actor_id: actorId, action, target_type: target.type, target_id: target.id, meta });
}

export const ok = (body: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...body }, { headers: { "cache-control": "no-store" } });

export function fail(e: unknown, where: string) {
  if (e instanceof AgentError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
  console.error(`[agents/${where}]`, e instanceof Error ? e.message : e);
  if (e instanceof NotConfiguredError) return NextResponse.json({ ok: false, message: "Agents aren't set up on this site yet: the server key is missing." }, { status: 503 });
  return NextResponse.json({ ok: false, message: "Something went wrong. Try again in a minute." }, { status: 500 });
}
