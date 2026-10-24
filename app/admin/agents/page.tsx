"use client";

import { Suspense } from "react";
import { AgentsAdmin } from "@/components/agents/admin/agents-admin";

/** PowerProof Agents for staff: funnel, kill switches, demand, catalog, failures, margin, support, stores */
export default function AdminAgentsPage() {
  return (
    <Suspense>
      <AgentsAdmin />
    </Suspense>
  );
}
