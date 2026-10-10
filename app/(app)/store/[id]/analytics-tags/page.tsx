"use client";

import { IntegrationsList } from "@/components/integrations/integrations-list";

/** Store › Domain and SEO › Analytics tags. The tags apply to every store on the account. */
export default function AnalyticsTagsPage() {
  return <IntegrationsList title="Analytics tags" description="Your Google Analytics and Microsoft Clarity IDs. We add the tags to every page of your stores, product pages and checkout." />;
}
