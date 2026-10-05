"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { useApi } from "@/hooks/use-api";
import { getIntegrations } from "@/lib/api";

export default function IntegrationsPage() {
  const { data, loading, error, reload, setData } = useApi(getIntegrations, []);
  return (
    <>
      <PageHeader title="Integrations" description="Paste one ID and we add the tracking code to every store, product and checkout page. No code to touch." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data?.map((i) => (
            <IntegrationCard key={i.id} integration={i} onChange={(next) => setData(data.map((x) => (x.id === next.id ? next : x)))} />
          ))}
        </div>
      )}
      <p className="mt-6 text-sm text-muted-foreground">More coming: Meta Pixel, Mailchimp and webhooks. Tell us which one you need first.</p>
    </>
  );
}
