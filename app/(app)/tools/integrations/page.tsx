"use client";

import { Connections } from "@/components/integrations/connections";
import { IntegrationsList } from "@/components/integrations/integrations-list";

export default function IntegrationsPage() {
  return (
    <>
      <IntegrationsList />
      <Connections />
    </>
  );
}
