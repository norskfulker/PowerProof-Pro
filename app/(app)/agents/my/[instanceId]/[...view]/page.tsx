"use client";

import { use } from "react";
import { AgentView } from "@/components/agents/agent-view";

/** An agent's own screens (Payment Chaser: customers, invoices, a message, upload), from agents/ui.tsx */
export default function AgentViewPage({ params }: { params: Promise<{ instanceId: string; view: string[] }> }) {
  const { instanceId, view } = use(params);
  return <AgentView instanceId={instanceId} path={view} />;
}
