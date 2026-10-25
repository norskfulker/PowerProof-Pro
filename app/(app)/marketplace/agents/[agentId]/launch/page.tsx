import type { Metadata } from "next";
import { getManifest } from "@/agents/index";
import { AgentsGate } from "@/components/agents/bits";
import { LaunchAgent } from "@/components/agents/launch-agent";
import { PageHeader } from "@/components/pp/page-header";

type Params = { params: Promise<{ agentId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const m = getManifest((await params).agentId);
  return { title: m ? `Launch ${m.name}` : "Launch agent" };
}

/** Marketplace › agent › Launch: created for this workspace with a short run, then its details below */
export default async function LaunchAgentPage({ params }: Params) {
  const { agentId } = await params;
  const m = getManifest(agentId);
  return (
    <AgentsGate>
      <PageHeader title={m ? `Launch ${m.name}` : "Launch agent"} back={{ href: `/marketplace/agents/${agentId}`, label: m?.name ?? "Agent" }} />
      <LaunchAgent agentId={agentId} />
    </AgentsGate>
  );
}
