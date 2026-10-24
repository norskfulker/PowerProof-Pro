import "server-only";
import { z } from "zod";
import { AgentError, fail, ok, requireStoreAgents } from "@/lib/server/agents/access";
import { agentsAdmin, must } from "@/lib/server/agents/db";
import { googleConfig } from "@/lib/server/agents/connectors/google";
import { accessTokenFor, connectGoogle, GoogleError, pickSheet, refreshSheet } from "@/lib/server/agents/connectors/sheets";

/**
 * A store's connections (shared by all its agents). Secrets never come back to the browser; the
 * only token the browser gets is a short-lived Google access token for the Picker, which Google
 * requires to show the owner's own files.
 * ops: google_start (popup code → new connection), google_token (for the Picker), google_pick,
 * test (read it now), remove.
 */
export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("google_start"), storeId: z.string().uuid(), code: z.string().min(10).max(2000) }),
  z.object({ op: z.literal("google_token"), connectionId: z.string().uuid() }),
  z.object({ op: z.literal("google_pick"), connectionId: z.string().uuid(), fileId: z.string().min(10).max(200), name: z.string().max(200), instanceId: z.string().uuid().optional(), connectorKey: z.string().max(40).optional() }),
  z.object({ op: z.literal("test"), connectionId: z.string().uuid() }),
  z.object({ op: z.literal("remove"), connectionId: z.string().uuid() }),
]);

async function connectionStore(id: string): Promise<string> {
  const { data } = await agentsAdmin().from("agent_connections").select("store_id").eq("id", id).maybeSingle();
  if (!data) throw new AgentError("That connection wasn't found.", 404);
  return data.store_id as string;
}

export async function GET() {
  return ok({ google: googleConfig() ? { clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? null, appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? null } : null });
}

export async function POST(request: Request) {
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return fail(new AgentError("That request wasn't right."), "connections");
  try {
    const d = b.data;
    if (d.op === "google_start") {
      const user = await requireStoreAgents(d.storeId);
      return ok(await connectGoogle(d.storeId, d.code, user.id));
    }
    const storeId = await connectionStore(d.connectionId);
    await requireStoreAgents(storeId);
    const sb = agentsAdmin();
    switch (d.op) {
      case "google_token":
        return ok({ accessToken: await accessTokenFor(d.connectionId) });
      case "google_pick": {
        if (d.instanceId) {
          const { data: inst } = await sb.from("agent_instances").select("store_id").eq("id", d.instanceId).maybeSingle();
          if (inst?.store_id !== storeId) throw new AgentError("That agent wasn't found.", 404);
          must(await sb.from("agent_instance_connections").upsert({ instance_id: d.instanceId, connector_key: d.connectorKey ?? "sheet", connection_id: d.connectionId, store_id: storeId }), "link sheet");
        }
        const r = await pickSheet(d.connectionId, d.fileId, d.name);
        return r.ok ? ok({ summary: r.summary ?? null, note: r.note ?? null }) : fail(new AgentError(r.error), "connections");
      }
      case "test": {
        const r = await refreshSheet(d.connectionId);
        const { data } = await sb.from("agent_connections").select("status, last_error").eq("id", d.connectionId).maybeSingle();
        return ok({ status: data?.status ?? "error", problem: data?.last_error ?? (r.ok ? null : r.error), summary: r.ok ? ((r as { summary?: unknown }).summary ?? null) : null });
      }
      case "remove":
        // The sealed token goes with the row; agents that used it stop reading it
        must(await sb.from("agent_connections").delete().eq("id", d.connectionId), "remove connection");
        return ok();
    }
  } catch (e) {
    if (e instanceof GoogleError) return fail(new AgentError(e.message, 400), "connections");
    return fail(e, "connections");
  }
}
