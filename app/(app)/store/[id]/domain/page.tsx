"use client";

import { use } from "react";
import { DomainWizard } from "@/components/domains/domain-wizard";
import { SubdomainCard } from "@/components/domains/subdomain-card";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getDomains } from "@/lib/api";

export default function StoreDomainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const domains = useApi(() => getDomains(id), [id], { live: true });
  return (
    <>
      <title>Domain · PowerProof</title>
      <PageHeader title="Domain" description="Where buyers find this store: a free address that always works, and your own domain on Pro." />
      {domains.error ? (
        <ErrorState message={domains.error} onRetry={domains.reload} />
      ) : !domains.data ? (
        <div className="flex max-w-3xl flex-col gap-6" aria-busy>
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
        </div>
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <SubdomainCard key={domains.data.subdomain} storeId={id} domains={domains.data} onChange={domains.setData} />
          <DomainWizard storeId={id} domains={domains.data} onChange={domains.setData} />
        </div>
      )}
    </>
  );
}
