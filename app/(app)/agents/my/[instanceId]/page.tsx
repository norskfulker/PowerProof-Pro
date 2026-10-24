"use client";

import { use } from "react";
import { AgentDetail } from "@/components/agents/agent-detail";

export default function AgentInstancePage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = use(params);
  return <AgentDetail instanceId={instanceId} />;
}
