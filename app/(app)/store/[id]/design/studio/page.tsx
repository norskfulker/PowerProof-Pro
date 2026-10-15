"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AiStudio } from "@/components/page-builder/ai-studio";
import { ErrorState } from "@/components/pp/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getEditorSession } from "@/lib/api";

/** AI Studio (My Store › Create with AI): build the store by chatting. ?page=<id> picks the page; the home page by default. */
export default function StudioPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const pageId = useSearchParams().get("page") || "home";
  const { data, error, reload } = useApi(() => getEditorSession(pageId), [pageId]);
  if (error) return <div className="mx-auto max-w-lg p-6"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) {
    return (
      <div className="grid min-h-[70dvh] grid-cols-1 gap-4 p-4 lg:grid-cols-[24rem_1fr]" aria-busy>
        <Skeleton className="h-full" />
        <Skeleton className="hidden h-full lg:block" />
      </div>
    );
  }
  return (
    <>
      <title>AI Studio · PowerProof</title>
      <AiStudio key={data.page.id} session={data} />
    </>
  );
}
