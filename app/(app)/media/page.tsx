"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Film, ImageIcon, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { MediaUploader } from "@/components/media/media-uploader";
import { MediaImg } from "@/components/media/tile-background";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Segmented } from "@/components/pp/segmented";
import { SaveBar } from "@/components/save/save-bar";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { useMediaUrl } from "@/hooks/use-media-url";
import { deleteMedia, getMediaLibrary, updateMedia, type MediaListItem } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatBytes } from "@/lib/money";

type Filter = "all" | "image" | "gif" | "video" | "ai";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "gif", label: "GIFs" },
  { value: "video", label: "Videos" },
  { value: "ai", label: "Made with AI" },
];
const KIND_LABEL = { image: "Image", gif: "GIF", video: "Video" } as const;

function Thumb({ item, className }: { item: MediaListItem; className?: string }) {
  const { url } = useMediaUrl(item.kind === "video" ? item.src : undefined);
  if (item.kind === "video") {
    return (
      <span className={className}>
        {url ? <video src={url} muted playsInline preload="metadata" aria-hidden className="absolute inset-0 size-full object-cover" /> : null}
        <span className="absolute bottom-2 left-2 grid size-7 place-items-center rounded-full bg-black/60 text-white"><Film className="size-3.5" aria-hidden /></span>
      </span>
    );
  }
  return (
    <span className={className}>
      <MediaImg src={item.src} alt={item.alt} decorative className="absolute inset-0" />
    </span>
  );
}

function Details({ item, onClose, onSaved, onDelete }: { item: MediaListItem; onClose: () => void; onSaved: (m: MediaListItem) => void; onDelete: () => void }) {
  const saved = { name: item.name, alt: item.alt };
  const [draft, setDraft] = useState(saved);
  const unsaved = useUnsavedGuard();
  const bar = useDirtyForm({
    value: draft,
    saved,
    onSave: async (v) => onSaved({ ...item, ...(await updateMedia(item.id, v)) }),
    onDiscard: () => setDraft(saved),
    savedMessage: "File details saved",
  });
  return (
    <Sheet open onOpenChange={(o) => !o && (bar.dirty ? unsaved.confirmLeave(onClose) : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl [overflow-wrap:anywhere]">{item.name}</SheetTitle>
          <SheetDescription>
            {KIND_LABEL[item.kind]} · {formatBytes(item.size)}
            {item.width && item.height ? ` · ${item.width}×${item.height}` : ""} · {item.source === "ai" ? "Made with AI" : "Uploaded"} {formatDate(item.createdAt)}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          <Thumb item={item} className="relative block aspect-video overflow-hidden rounded-media border bg-muted" />
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              bar.save();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="md-name">Name</Label>
              <Input id="md-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            {item.kind !== "video" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="md-alt">Description for screen readers</Label>
                <Textarea id="md-alt" rows={2} value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} aria-describedby="md-alt-h" />
                <p id="md-alt-h" className="text-sm text-muted-foreground">Used wherever this file is placed, unless that place has its own.</p>
              </div>
            )}
            {item.prompt && (
              <p className="rounded-control bg-surface-sunken p-3 text-sm"><span className="eyebrow mb-1 block">Prompt</span>{item.prompt}</p>
            )}
            <SaveBar state={bar} bottomOffset="none" className="max-md:sticky max-md:bottom-0" />
          </form>
          <section aria-labelledby="md-uses-h" className="flex flex-col gap-2">
            <h2 id="md-uses-h" className="font-sans text-base font-semibold tracking-normal">Where it&apos;s used</h2>
            {item.uses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not used anywhere yet.</p>
            ) : (
              <ul className="divide-y rounded-control border">
                {item.uses.map((u, i) => (
                  <li key={i}>
                    <Link href={u.href} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted">
                      <span className="min-w-0 [overflow-wrap:anywhere]">{u.label}</span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Button type="button" variant="ghost" className="self-start text-danger" onClick={onDelete}>
            <Trash2 aria-hidden /> Delete file
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function MediaPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error, reload, setData } = useApi(() => getMediaLibrary({ search: q, kind: filter === "all" ? undefined : filter }), [q, filter], { live: true });
  const [openId, setOpenId] = useState<string>();
  const [toDelete, setToDelete] = useState<MediaListItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const open = data?.find((m) => m.id === openId);

  return (
    <>
      <title>Media · PowerProof</title>
      <PageHeader
        title="Media"
        description="Every image, GIF and video you've uploaded or made with AI, across all your stores."
        actions={
          <>
            <Button asChild variant="secondary"><Link href="/images"><Sparkles aria-hidden /> Create with AI</Link></Button>
            <Button onClick={() => setUploadOpen(true)}><Upload aria-hidden /> Upload</Button>
          </>
        }
      />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label="Search media" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, description or prompt" className="pl-9" />
        </div>
        <Segmented label="File type" value={filter} onChange={setFilter} options={FILTERS} className="max-w-full overflow-x-auto md:ml-auto" />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy>
          {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-card" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          nextStep
          icon={ImageIcon}
          title={q || filter !== "all" ? "Nothing matches." : "No files yet."}
          body={q || filter !== "all" ? "Try another word or file type." : "Upload a picture or video, or make one with AI. It's kept here so you can use it anywhere."}
          action={!q && filter === "all" ? <Button onClick={() => setUploadOpen(true)}><Upload aria-hidden /> Upload a file</Button> : undefined}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Files">
          {data.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setOpenId(m.id)} className="group flex w-full flex-col gap-2 rounded-card border bg-surface p-2 text-left transition-colors hover:border-border-strong" aria-label={`${m.name}, ${KIND_LABEL[m.kind]}. Used in ${m.uses.length} place${m.uses.length === 1 ? "" : "s"}.`}>
                <Thumb item={m} className="relative block aspect-square overflow-hidden rounded-control bg-muted" />
                <span className="flex flex-col gap-0.5 px-1 pb-1">
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {m.source === "ai" && <Sparkles className="size-3" aria-hidden />}
                    {KIND_LABEL[m.kind]} · {formatBytes(m.size)}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.uses.length ? `Used in ${m.uses.length} place${m.uses.length === 1 ? "" : "s"}` : "Not used yet"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Details
          key={open.id}
          item={open}
          onClose={() => setOpenId(undefined)}
          onSaved={(m) => setData(data!.map((x) => (x.id === m.id ? m : x)))}
          onDelete={() => setToDelete(open)}
        />
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Upload to your library</DialogTitle>
            <DialogDescription>It&apos;s kept here so you can use it for any product, page or store.</DialogDescription>
          </DialogHeader>
          <MediaUploader
            label="File"
            kinds={["image", "gif", "video"]}
            withFocal={false}
            withPoster={false}
            onChange={(v) => {
              if (!v) return;
              setUploadOpen(false);
              reload();
              toast.success("Added to your library");
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "this file"}?`}
        description={
          toDelete?.uses.length
            ? `It's used in ${toDelete.uses.length} place${toDelete.uses.length === 1 ? "" : "s"}. Those spots will show an empty placeholder until you choose another file.`
            : "It isn't used anywhere. This can't be undone."
        }
        confirmLabel="Delete file"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteMedia(toDelete.id);
          setOpenId(undefined);
          setToDelete(null);
          reload();
          toast.success("File deleted");
        }}
      />
    </>
  );
}
