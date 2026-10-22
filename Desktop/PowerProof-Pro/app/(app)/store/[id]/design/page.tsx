"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Brush, House, Plus, Sparkles } from "lucide-react";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Segmented } from "@/components/pp/segmented";
import { StatusPill } from "@/components/pp/status-pill";
import { TemplateThumb } from "@/components/page-builder/template-thumb";
import { AddPageDialog, editPageHref } from "@/components/store-admin/add-page-dialog";
import { useSetupMode, type SetupWay } from "@/components/store-admin/use-setup-mode";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getVisualPages, type VisualPageSummary } from "@/lib/api";

const STATUS: Record<VisualPageSummary["status"], [string, "success" | "warning" | "neutral"]> = {
  published: ["Live", "success"],
  changed: ["Changes", "warning"],
  draft: ["Draft", "neutral"],
};

/**
 * My Store: pick the page first, then it opens, in the editor or in AI Studio (the store's own way
 * by default). Copying another store's look is under Theme › Start inside the editor.
 */
export default function MyStorePage() {
  const { data, loading, error, reload } = useApi(getVisualPages, [], { live: true });
  const setup = useSetupMode();
  const [picked, setPicked] = useState<SetupWay>();
  const way: SetupWay = picked ?? (setup.mode === "ai" ? "ai" : "manual");
  const [adding, setAdding] = useState(false);

  const home = data?.find((p) => p.home);
  const pages: { id: string; title: string; path: string; template: string; status: VisualPageSummary["status"]; home?: boolean }[] = [
    { id: home?.id ?? "home", title: "Home page", path: "/", template: "home", status: home?.status ?? "draft", home: true },
    ...(data ?? []).filter((p) => !p.home).map((p) => ({ id: p.id, title: p.title, path: `/p/${p.slug}`, template: p.template, status: p.status })),
  ];

  return (
    <>
      <title>My Store · PowerProof</title>
      <PageHeader
        title="My Store"
        actions={
          <>
            <Segmented
              label="Open pages in"
              value={way}
              onChange={setPicked}
              options={[
                { value: "manual", label: <span className="inline-flex items-center gap-1.5"><Brush className="size-3.5" aria-hidden /> Custom</span> },
                { value: "ai", label: <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5" aria-hidden /> With AI</span> },
              ]}
            />
            <Button type="button" onClick={() => setAdding(true)}><Plus aria-hidden /> New page</Button>
          </>
        }
      />
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Which page do you want to design?</h2>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <li key={i}><Skeleton className="h-56 rounded-card" /></li>)}</ul>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Your pages">
          {pages.map((p) => (
            <li key={p.id}>
              <Link
                href={editPageHref(p.id, way === "ai")}
                className="group flex h-full flex-col gap-3 rounded-card border bg-surface p-2 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift"
              >
                <TemplateThumb template={p.template} className="aspect-[16/9] p-4" />
                <span className="flex items-center gap-2 px-2 pb-1.5">
                  {p.home && <House className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.title}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{p.path}</span>
                  </span>
                  <StatusPill status={p.status} label={STATUS[p.status][0]} tone={STATUS[p.status][1]} />
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AddPageDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}
