"use client";

import { Plug } from "lucide-react";
import { ComingSoon } from "@/components/pp/coming-soon";
import { PageHeader } from "@/components/pp/page-header";

/** The analytics integrations (Google Analytics, Microsoft Clarity). Shared by Tools and Store › Analytics tags. */
export function IntegrationsList({ title = "Integrations", description = "Paste one ID and we add the tracking code to every store, product and checkout page. No code to touch." }: { title?: string; description?: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <ComingSoon title="Analytics integrations open soon." body="Google Analytics and Microsoft Clarity will connect here. Your store already works without them." />
      <span className="sr-only"><Plug aria-hidden /></span>
    </>
  );
}
