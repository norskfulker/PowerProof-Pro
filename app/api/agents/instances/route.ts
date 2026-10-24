import "server-only";
import { z } from "zod";
import { fail, ok, requireStoreAgents } from "@/lib/server/agents/access";
import { createInstance } from "@/lib/server/agents/instances";

/** Starts an agent for a store (status "setup"; nothing runs until the owner switches it on). */
export const dynamic = "force-dynamic";

const body = z.object({ storeId: z.string().uuid(), agentId: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/) });

export async function POST(request: Request) {
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return fail(new Error("bad request"), "instances");
  try {
    const user = await requireStoreAgents(b.data.storeId);
    return ok({ instanceId: await createInstance(b.data.storeId, b.data.agentId, user.id) });
  } catch (e) {
    return fail(e, "instances");
  }
}
