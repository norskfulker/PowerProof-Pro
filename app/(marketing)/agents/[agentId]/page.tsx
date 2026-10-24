import type { Metadata } from "next";
import { getManifest } from "@/agents/index";
import { AgentPage } from "@/components/agents/agent-page";

type Params = { params: Promise<{ agentId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const m = getManifest((await params).agentId);
  return m ? { title: `${m.name}: ${m.tagline}`, description: m.description } : { title: "Agents" };
}

/** One agent's public page (no login); "Try free" leads to sign-up and that agent's setup */
export default async function AgentPublicPage({ params }: Params) {
  const { agentId } = await params;
  return (
    <section className="gutter mx-auto max-w-[1200px] pt-8 pb-20 md:pt-14">
      <AgentPage agentId={agentId} />
    </section>
  );
}
