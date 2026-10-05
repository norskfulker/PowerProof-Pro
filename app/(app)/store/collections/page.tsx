"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FolderOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PALETTES } from "@/components/pp/image-maker";
import { PageHeader } from "@/components/pp/page-header";
import { CoverArt } from "@/components/pp/product-cover";
import { useApi } from "@/hooks/use-api";
import { deleteCollection, getCollections, getProducts, moveCollection, saveCollection } from "@/lib/api";
import type { Collection } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = Omit<Collection, "id" | "slug"> & { id?: string };

export default function CollectionsPage() {
  const { data, loading, error, reload, setData } = useApi(getCollections, []);
  const products = useApi(() => getProducts({ status: "published" }), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [toDelete, setToDelete] = useState<Collection | null>(null);

  const newDraft = (): Draft => ({ name: "", description: "", productIds: [], cover: { template: "block", title: "", subtitle: "", ...PALETTES[0] } });

  async function save() {
    if (!draft) return;
    setPending(true);
    setFormError(undefined);
    try {
      setData(await saveCollection({ ...draft, cover: { ...draft.cover, title: draft.name } }));
      toast.success(draft.id ? "Collection updated" : "Collection added");
      setDraft(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Collections"
        description="Group products so buyers can browse. Each one gets a tile on your store and its own page."
        actions={<Button onClick={() => { setDraft(newDraft()); setFormError(undefined); }}><Plus aria-hidden /> New collection</Button>}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-card" />)}</div>
      ) : data?.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No collections yet." body="Make one for each kind of thing you sell. Buyers find stuff faster." action={<Button onClick={() => setDraft(newDraft())}><Plus aria-hidden /> New collection</Button>} />
      ) : (
        <ol className="flex flex-col gap-3">
          {data?.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border bg-surface p-3">
              <CoverArt cover={c.cover} size="xs" className="w-20 shrink-0 sm:w-24" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">{c.productIds.length} products · /c/{c.slug}</p>
              </div>
              <div className="flex shrink-0 gap-0.5 max-sm:w-full max-sm:justify-end">
              <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={async () => setData(await moveCollection(c.id, -1))} aria-label={`Move ${c.name} up`}><ArrowUp /></Button>
              <Button variant="ghost" size="icon-sm" disabled={i === (data?.length ?? 0) - 1} onClick={async () => setData(await moveCollection(c.id, 1))} aria-label={`Move ${c.name} down`}><ArrowDown /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => { setDraft({ ...c }); setFormError(undefined); }} aria-label={`Edit ${c.name}`}><Pencil /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Sheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{draft?.id ? "Edit collection" : "New collection"}</SheetTitle>
            <SheetDescription>Pick products and a tile colour.</SheetDescription>
          </SheetHeader>
          {draft && (
            <form id="col" noValidate className="flex flex-col gap-4 px-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
              {formError && <p role="alert" className="text-sm font-medium text-danger">{formError}</p>}
              <CoverArt cover={{ ...draft.cover, title: draft.name || "Collection" }} size="sm" />
              <div className="flex flex-col gap-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="c-desc">Description</Label><Textarea id="c-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Tile colour</legend>
                <div className="flex flex-wrap gap-2">
                  {PALETTES.map((p) => (
                    <button key={p.name} type="button" aria-label={p.name} aria-pressed={draft.cover.bg === p.bg} onClick={() => setDraft({ ...draft, cover: { ...draft.cover, bg: p.bg, fg: p.fg, accent: p.accent } })}
                      className={cn("size-11 rounded-full border", draft.cover.bg === p.bg && "outline-2 outline-offset-2 outline-primary")} style={{ background: p.bg }} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Products ({draft.productIds.length})</legend>
                <ul className="max-h-72 overflow-y-auto rounded-control border p-1">
                  {products.data?.map((p) => (
                    <li key={p.id}>
                      <label className="flex min-h-11 items-center gap-3 rounded-[6px] px-2 text-sm hover:bg-muted">
                        <Checkbox checked={draft.productIds.includes(p.id)} onCheckedChange={(v) => setDraft({ ...draft, productIds: v ? [...draft.productIds, p.id] : draft.productIds.filter((x) => x !== p.id) })} />
                        <span className="truncate">{p.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </form>
          )}
          <SheetFooter><Button type="submit" form="col" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Save collection</Button></SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.name}”?`}
        description="The products stay in your store. Only the grouping and its page go."
        confirmLabel="Delete collection"
        onConfirm={async () => {
          if (!toDelete) return;
          setData(await deleteCollection(toDelete.id));
          toast.success("Collection deleted");
        }}
      />
    </>
  );
}
