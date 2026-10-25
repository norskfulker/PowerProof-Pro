"use client";

import { use } from "react";
import { PageHeader } from "@/components/pp/page-header";
import { SetupWizard } from "@/components/agents/setup-wizard";

export default function AgentSetupPage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = use(params);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Set up your agent" back={{ href: "/marketplace?tab=subscribed", label: "Subscribed agents" }} />
      <SetupWizard instanceId={instanceId} />
    </div>
  );
}
