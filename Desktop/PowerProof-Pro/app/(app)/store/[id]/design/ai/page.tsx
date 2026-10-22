"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AiSetup } from "@/components/store-admin/ai-setup";
import { PageHeader } from "@/components/pp/page-header";
import { ErrorState } from "@/components/pp/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getStore } from "@/lib/api";

const STUDIO = "/store/current/design/studio";

/**
 * My Store › Create with AI, before the store first opens: AI drafts the whole store (products,
 * About, FAQ, look) for the creator to review, then AI Studio builds the home page. Once the store
 * has opened this goes straight to AI Studio.
 */
export default function AiStorePage() {
  const router = useRouter();
  const { data: store, error, reload } = useApi(getStore, []);
  useEffect(() => {
    if (store?.onboarded) router.replace(STUDIO);
  }, [store, router]);

  return (
    <>
      <title>Create with AI · PowerProof</title>
      <PageHeader title="Create with AI" className="mb-4 md:mb-6" />
      <div className="max-w-2xl">
        {error ? <ErrorState message={error} onRetry={reload} /> : !store || store.onboarded ? <Skeleton className="h-96 rounded-dialog" /> : <AiSetup store={store} onSkip={() => router.push(STUDIO)} />}
      </div>
    </>
  );
}
