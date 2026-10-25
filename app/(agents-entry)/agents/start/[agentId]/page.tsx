import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getManifest } from "@/agents/index";
import { StartAgent } from "@/components/agents/start-agent";
import { sbServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your agent" };

type Params = { params: Promise<{ agentId: string }> };

/**
 * "Try free" lands here. Signed out: sign up first, then come back (signup carries ?next=).
 * No store yet: create one here (the app's own store step), then launch the agent inside the app.
 */
export default async function StartAgentPage({ params }: Params) {
  const { agentId } = await params;
  const m = getManifest(agentId);
  const sb = await sbServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/signup?next=${encodeURIComponent(`/agents/start/${agentId}`)}`);
  const { data: stores } = await sb.rpc("my_stores");
  // With a store, launching happens inside the app (its menu and top bar)
  if (m && (stores ?? []).length > 0) redirect(`/marketplace/agents/${agentId}/launch`);
  return <StartAgent agentId={agentId} agentName={m?.name ?? null} hasStore={(stores ?? []).length > 0} />;
}
