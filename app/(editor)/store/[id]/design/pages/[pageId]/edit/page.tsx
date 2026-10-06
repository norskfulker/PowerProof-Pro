"use client";

import { use } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/pp/empty-state";
import { EditorShell } from "@/components/page-builder/editor-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getVisualPage } from "@/lib/api";

export default function EditPagePage({ params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { pageId: id } = use(params);
  const { data, error, reload } = useApi(() => getVisualPage(id), [id]);
  if (error) {
    return (
      <main id="main" className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <ErrorState message={error} onRetry={reload} />
        <Link href="/store/current/design/pages" className="inline-flex min-h-11 items-center self-center font-medium text-primary underline-offset-4 hover:underline">
          Back to store pages
        </Link>
      </main>
    );
  }
  if (!data) {
    return (
      <main id="main" className="flex h-dvh flex-col" aria-busy>
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="ml-auto h-10 w-28" />
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[17rem_1fr_20rem]">
          <Skeleton className="hidden h-full lg:block" />
          <Skeleton className="h-full" />
          <Skeleton className="hidden h-full lg:block" />
        </div>
      </main>
    );
  }
  return (
    <>
      <title>{`Editing ${data.page.title} · PowerProof`}</title>
      <EditorShell key={data.page.id} page={data.page} context={data.context} />
    </>
  );
}
