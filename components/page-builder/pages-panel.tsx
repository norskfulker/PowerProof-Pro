"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, History, House, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { ErrorState } from "@/components/pp/empty-state";
import { StatusPill } from "@/components/pp/status-pill";
import { AddPageDialog, editPageHref, PAGE_STARTERS } from "@/components/store-admin/add-page-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { createVisualPage, deleteVisualPage, duplicateVisualPage, getVisualPages, type VisualPageSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS: Record<VisualPageSummary["status"], [string, "success" | "warning" | "neutral"]> = {
  published: ["Live", "success"],
  changed: ["Changes", "warning"],
  draft: ["Draft", "neutral"],
};

/**
 * The store's pages, inside the editor: open one to edit it (this page is saved first), add one,
 * or start from a ready-made page the store doesn't have yet.
 */
export function PagesPanel({ slug, currentId, storeLive, beforeLeave }: { slug: string; currentId: string; storeLive: boolean; beforeLeave: () => Promise<void> }) {
  const router = useRouter();
  const { data, loading, error, reload } = useApi(getVisualPages, [], { live: true });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [toDelete, setToDelete] = useState<VisualPageSummary>();

  async function open(id: string) {
    if (id === currentId) return;
    await beforeLeave();
    router.push(editPageHref(id));
  }

  async function start(template: string, title: string) {
    setBusy(template);
    try {
      const p = await createVisualPage({ templateId: template, title });
      await beforeLeave();
      router.push(editPageHref(p.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the page.");
      setBusy(undefined);
    }
  }

  const home = data?.find((p) => p.home);
  const others = (data ?? []).filter((p) => !p.home);
  const have = new Set((data ?? []).map((p) => p.template));
  const starters = PAGE_STARTERS.filter((s) => !have.has(s.template));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Every page shares the theme, header and footer.</p>
        <Button type="button" size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Add
        </Button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-control" />)}
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Your pages">
          <PageRow
            title="Home page"
            icon
            path="/"
            current={!!home && home.id === currentId}
            status={home?.status === "changed" ? "changed" : storeLive && home?.status !== "draft" ? "published" : "draft"}
            onOpen={() => (home ? open(home.id) : beforeLeave().then(() => router.push(editPageHref("home"))))}
            menu={home && <RowMenu page={home} slug={slug} onDuplicate={undefined} onDelete={undefined} />}
          />
          {others.map((p) => (
            <PageRow
              key={p.id}
              title={p.title}
              path={`/p/${p.slug}`}
              current={p.id === currentId}
              status={p.status}
              edited={p.updatedAt}
              onOpen={() => open(p.id)}
              menu={
                <RowMenu
                  page={p}
                  slug={slug}
                  onDuplicate={async () => {
                    await duplicateVisualPage(p.id);
                    toast.success("Copy made", { description: "It's a draft until you publish it." });
                    reload();
                  }}
                  onDelete={p.id === currentId ? undefined : () => setToDelete(p)}
                />
              }
            />
          ))}
        </ul>
      )}

      {starters.length > 0 && (
        <section aria-labelledby="pp-starters" className="flex flex-col gap-2">
          <h3 id="pp-starters" className="eyebrow">Ready to make</h3>
          <ul className="flex flex-col gap-2">
            {starters.map((s) => (
              <li key={s.template} className="flex items-start gap-3 rounded-control border border-dashed bg-surface p-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{s.title}</span>
                  <span className="text-xs text-muted-foreground">{s.body}</span>
                </span>
                <Button type="button" variant="secondary" size="sm" disabled={!!busy} onClick={() => start(s.template, s.title)} aria-label={`Create a ${s.title.toLowerCase()}`}>
                  Create
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AddPageDialog open={adding} onOpenChange={setAdding} beforeLeave={beforeLeave} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title={`Delete ${toDelete?.title ?? "this page"}?`}
        description="It disappears from your store straight away, along with its versions."
        confirmLabel="Delete page"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteVisualPage(toDelete.id);
          toast.success("Page deleted");
          reload();
        }}
      />
    </div>
  );
}

function PageRow({ title, path, status, current, edited, icon, onOpen, menu }: { title: string; path: string; status: VisualPageSummary["status"]; current: boolean; edited?: string; icon?: boolean; onOpen: () => void; menu?: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-1 rounded-control border bg-surface pr-1", current && "border-primary bg-primary-soft/60")}>
      <button type="button" onClick={onOpen} aria-current={current ? "page" : undefined} className="flex min-h-14 min-w-0 flex-1 flex-col items-start gap-0.5 rounded-control px-3 py-2 text-left hover:bg-muted/60">
        <span className="flex w-full items-center gap-2">
          {icon && <House className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
          <StatusPill status={status} label={STATUS[status][0]} tone={STATUS[status][1]} className="ml-auto shrink-0" />
        </span>
        <span className="w-full truncate font-mono text-[0.6875rem] text-muted-foreground">
          {path}
          {edited && <span className="font-sans"> · {current ? "Editing now" : `Edited ${formatDate(edited)}`}</span>}
          {!edited && current && <span className="font-sans"> · Editing now</span>}
        </span>
      </button>
      {menu}
    </li>
  );
}

function RowMenu({ page, slug, onDuplicate, onDelete }: { page: VisualPageSummary; slug: string; onDuplicate?: () => void; onDelete?: () => void }) {
  const live = page.home ? `/s/${slug}` : `/s/${slug}/p/${page.slug}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`More for ${page.home ? "the home page" : page.title}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/store/current/design/pages/${page.id}/versions`}>
            <History aria-hidden /> Versions
          </Link>
        </DropdownMenuItem>
        {page.status !== "draft" && (
          <DropdownMenuItem asChild>
            <a href={live} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> View live
            </a>
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy aria-hidden /> Duplicate
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger" onSelect={onDelete}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
