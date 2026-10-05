"use client";

import { useState } from "react";
import Link from "next/link";
import { Code2, Eye, MoreHorizontal, PanelsTopLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { PageRenderer } from "@/components/pages/page-renderer";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { deletePage, getPages } from "@/lib/api";
import { formatNumber, timeAgo } from "@/lib/format";
import { templateMeta } from "@/lib/templates";
import type { Page } from "@/lib/types";

function editHref(p: Page) {
  return p.mode === "html" ? `/pages/${p.id}/html` : `/pages/${p.id}/edit`;
}

export default function PagesListPage() {
  const { data, loading, error, reload } = useApi(getPages, [], { live: true });
  const [toDelete, setToDelete] = useState<Page | null>(null);

  return (
    <>
      <PageHeader
        title="Pages"
        description="Sales pages for your products. Use a template, or paste your own HTML and we wire the buy buttons."
        actions={
          <Button asChild>
            <Link href="/pages/new"><Plus aria-hidden /> New page</Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-card" />)}
        </div>
      ) : data?.length === 0 ? (
        <EmptyState
          icon={PanelsTopLeft}
          title="No pages yet."
          body="Your products already have a simple page on your store. Make a custom one when a product needs more selling."
          action={<Button asChild><Link href="/pages/new"><Plus aria-hidden /> Make a page</Link></Button>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-card border bg-surface">
              <Link href={editHref(p)} className="relative block h-48 overflow-hidden border-b bg-background" aria-label={`Edit ${p.title}`}>
                {p.mode === "html" ? (
                  <div className="grid h-full place-items-center bg-foreground p-4">
                    <pre className="line-clamp-6 w-full font-mono text-[11px] leading-5 whitespace-pre-wrap text-primary-foreground/80">{p.html}</pre>
                  </div>
                ) : (
                  <div className="pointer-events-none origin-top-left scale-[0.55]" style={{ width: "182%" }}>
                    <PageRenderer blocks={p.blocks} compact />
                  </div>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={editHref(p)} className="font-semibold hover:underline">{p.title}</Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.title}`}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link href={`/pages/${p.id}/edit`}><Pencil aria-hidden /> Visual editor</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href={`/pages/${p.id}/html`}><Code2 aria-hidden /> HTML and embed</Link></DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(p)}><Trash2 aria-hidden /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <StatusPill status={p.status} />
                  <span>{p.mode === "html" ? "Custom HTML" : templateMeta(p.template).name}</span>
                </div>
                <div className="mt-auto flex items-center justify-between pt-2 font-mono text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Eye className="size-3.5" aria-hidden /> {formatNumber(p.views)} views</span>
                  <span>Edited {timeAgo(p.updatedAt)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.title}”?`}
        description="The page goes offline straight away. The product stays on your store."
        confirmLabel="Delete page"
        onConfirm={async () => {
          if (!toDelete) return;
          await deletePage(toDelete.id);
          toast.success("Page deleted");
        }}
      />
    </>
  );
}
