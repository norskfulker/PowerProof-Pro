import type { Metadata } from "next";
import { getManifest } from "@/agents/index";
import { AgentPage } from "@/components/agents/agent-page";

type Params = { params: Promise<{ agentId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const m = getManifest((await params).agentId);
  return { title: m ? m.name : "Agent" };
}

/** One agent inside the app: same page as the public one, with the menu and top bar, launching into this workspace */
export default async function MarketplaceAgentPage({ params }: Params) {
  const { agentId } = await params;
  return <AgentPage agentId={agentId} inApp />;
}
