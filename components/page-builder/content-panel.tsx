"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ErrorState } from "@/components/pp/empty-state";
import { AboutForm, FaqForm } from "@/components/store-admin/store-info-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getStoreInfo } from "@/lib/api";
import type { AboutContent, FaqItem } from "@/lib/types";

/**
 * The store's About page and FAQ, in the editor: the About and FAQ sections (and their own pages)
 * show this, so the canvas follows every edit. Each saves itself, apart from the page's draft.
 */
export function ContentPanel({ storeId, slug, at, onAbout, onFaq }: { storeId: string; slug: string; at?: string; onAbout: (a: AboutContent) => void; onFaq: (f: FaqItem[]) => void }) {
  const { data, error, reload, setData } = useApi(() => getStoreInfo(storeId), [storeId]);
  const faq = useRef<HTMLElement>(null);
  useEffect(() => {
    if (data && at === "faq") faq.current?.scrollIntoView({ block: "start" });
  }, [data, at]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96 rounded-card" />;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">Used by the About and FAQ sections on any page, and by your store&apos;s own About and FAQ pages. Saved as you type, live straight away.</p>
      <section aria-labelledby="cp-about" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id="cp-about" className="font-display text-base font-extrabold">About you</h3>
          <Link href={`/s/${slug}/about`} target="_blank" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
            <ExternalLink className="size-3.5" aria-hidden /> View page
          </Link>
        </div>
        <AboutForm info={data} onSaved={setData} compact onLive={onAbout} />
      </section>
      <section ref={faq} aria-labelledby="cp-faq" className="flex scroll-mt-3 flex-col gap-3 border-t pt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 id="cp-faq" className="font-display text-base font-extrabold">FAQ</h3>
          <Link href={`/s/${slug}/faq`} target="_blank" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
            <ExternalLink className="size-3.5" aria-hidden /> View page
          </Link>
        </div>
        <FaqForm info={data} onSaved={setData} compact onLive={onFaq} />
      </section>
    </div>
  );
}
