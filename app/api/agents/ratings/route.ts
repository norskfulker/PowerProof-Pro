import "server-only";
import { z } from "zod";
import { AgentError, fail, ok, requireStoreAgents } from "@/lib/server/agents/access";
import { agentsAdmin } from "@/lib/server/agents/db";

/**
 * Stars for an agent, from stores that have run it. GET: this store's own rating and whether it may
 * rate. POST: rate (1–5, optional comment); one rating per store and agent, changeable. Everyone
 * reads the ratings themselves straight from agent_ratings (no names or emails in them).
 */
export const dynamic = "force-dynamic";

const ids = z.object({ agent: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/), store: z.string().uuid() });
const body = z.object({ agentId: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/), storeId: z.string().uuid(), stars: z.number().int().min(1).max(5), comment: z.string().trim().max(600).default("") });

/** A store may rate an agent once it has actually run it (a dry run doesn't count) */
async function hasRun(storeId: string, agentId: string): Promise<boolean> {
  const { data } = await agentsAdmin().from("agent_instances").select("last_run_at").eq("store_id", storeId).eq("agent_id", agentId).maybeSingle();
  return !!data?.last_run_at;
}

export async function GET(request: Request) {
  const u = new URL(request.url);
  const p = ids.safeParse({ agent: u.searchParams.get("agent"), store: u.searchParams.get("store") });
  if (!p.success) return fail(new AgentError("That request wasn't right."), "ratings");
  try {
    await requireStoreAgents(p.data.store);
    const [canRate, mine] = await Promise.all([hasRun(p.data.store, p.data.agent), agentsAdmin().from("agent_ratings").select("stars, comment").eq("agent_id", p.data.agent).eq("store_id", p.data.store).maybeSingle()]);
    return ok({ canRate, stars: (mine.data?.stars as number | undefined) ?? null, comment: (mine.data?.comment as string | undefined) ?? "" });
  } catch (e) {
    return fail(e, "ratings");
  }
}

export async function POST(request: Request) {
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return fail(new AgentError("Pick 1 to 5 stars; comments are up to 600 characters."), "ratings");
  try {
    const user = await requireStoreAgents(b.data.storeId);
    if (!(await hasRun(b.data.storeId, b.data.agentId))) throw new AgentError("Rate it once it has run for your store.", 409);
    const { error } = await agentsAdmin()
      .from("agent_ratings")
      .upsert({ agent_id: b.data.agentId, store_id: b.data.storeId, user_id: user.id, stars: b.data.stars, comment: b.data.comment, updated_at: new Date().toISOString() }, { onConflict: "agent_id,store_id" });
    if (error) throw new Error(error.message);
    return ok();
  } catch (e) {
    return fail(e, "ratings");
  }
}
