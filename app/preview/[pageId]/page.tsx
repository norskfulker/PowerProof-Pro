"use client";

import { use, useEffect, useState } from "react";
import { Eye, RefreshCw, X } from "lucide-react";
import { ErrorState } from "@/components/pp/empty-state";
import { DraftPage } from "@/components/page-builder/canvas";
import { EditorProvider } from "@/components/page-builder/editor-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getEditorSession } from "@/lib/api";
import { PREVIEW_CHANNEL } from "@/lib/pages/editor-store";

/**
 * The page being edited, full size in its own tab, as buyers would see it once published: the
 * unpublished draft with the store's header and footer. Follows the editor: every autosave there
 * refreshes it here. Links don't leave the preview.
 */
export default function DraftPreviewPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params);
  const { data, error, reload, setData } = useApi(() => getEditorSession(pageId), [pageId]);
  const [syncing, setSyncing] = useState(false);
  const [version, setVersion] = useState(0);
  const [screen, setScreen] = useState(800);

  useEffect(() => {
    const on = () => setScreen(window.innerHeight);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // The editor saved: show the new draft without a flash
  const ready = !!data;
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined" || !ready) return;
    const ch = new BroadcastChannel(PREVIEW_CHANNEL);
    // Any page's save can change the header, footer or theme shown here, so every save refreshes
    ch.onmessage = () => {
      setSyncing(true);
      getEditorSession(pageId)
        .then((s) => {
          setData(s);
          setVersion((v) => v + 1);
        })
        .catch(() => undefined)
        .finally(() => setSyncing(false));
    };
    return () => ch.close();
  }, [ready, pageId, setData]);

  if (error) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <ErrorState message={error} onRetry={reload} />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex min-h-dvh flex-col" aria-busy>
        <Skeleton className="h-16 rounded-none" />
        <Skeleton className="m-6 h-96" />
      </main>
    );
  }
  const title = data.page.template === "home" ? "Home page" : data.page.title;
  return (
    <>
      <title>{`Preview: ${title} · ${data.context.store.name}`}</title>
      <EditorProvider key={`${data.page.id}:${version}`} initial={data.page.draft} site={data.site}>
        <div className="flex min-h-dvh flex-col">
          <DraftPage context={data.context} screen={screen} />
        </div>
      </EditorProvider>
      {/* The preview's own bar: says what this is, floats over the page */}
      <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-surface/95 py-1.5 pr-1.5 pl-4 text-xs font-medium text-foreground shadow-lg backdrop-blur">
        {syncing ? <RefreshCw className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : <Eye className="size-3.5 text-primary" aria-hidden />}
        <span className="whitespace-nowrap">Preview of your draft{data.storeLive ? "" : " · not live yet"}</span>
        <span className="text-muted-foreground max-sm:hidden">· updates as you edit</span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => window.close()} aria-label="Close preview">
          <X />
        </Button>
      </div>
    </>
  );
}
