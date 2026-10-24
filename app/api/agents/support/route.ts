import "server-only";
import { z } from "zod";
import { AgentError, fail, ok, requireStoreAgents } from "@/lib/server/agents/access";
import { agentsAdmin } from "@/lib/server/agents/db";

/** "Report a wrong message" and help requests: saved with the message and its context for PowerProof staff. */
export const dynamic = "force-dynamic";

const body = z.object({
  storeId: z.string().uuid(),
  instanceId: z.string().uuid().optional(),
  kind: z.enum(["wrong_message", "help", "other"]),
  message: z.string().trim().min(1).max(2000),
  context: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return fail(new AgentError("Write a few words about what went wrong."), "support");
  try {
    const user = await requireStoreAgents(b.data.storeId);
    const context = JSON.stringify(b.data.context).length > 8000 ? { note: "Context too large to keep." } : b.data.context;
    await agentsAdmin().from("agent_support_items").insert({ store_id: b.data.storeId, instance_id: b.data.instanceId ?? null, user_id: user.id, kind: b.data.kind, message: b.data.message, context });
    return ok();
  } catch (e) {
    return fail(e, "support");
  }
}
