"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, FileText, History, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { createVisualPage, deleteVisualPage, duplicateVisualPage, getPageTemplates, getStore, getVisualPages, type VisualPageSummary } from "@/lib/api";
import { formatDate, storeUrl } from "@/lib/format";

const STATUS: Record<VisualPageSummary["status"], [string, "success" | "warning" | "neutral"]> = {
  published: ["Live", "success"],
  changed: ["Unpublished changes", "warning"],
  draft: ["Draft", "neutral"],
};

export default function StorePagesPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useApi(getVisualPages, [], { live: true });
  const store = useApi(getStore, []);
  const templates = getPageTemplates();
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState(templates[0].id);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<VisualPageSummary>();

  async function create() {
    if (title.trim().length < 2) return setTitleError("Give the page a name.");
    setBusy(true);
    try {
      const p = await createVisualPage({ templateId: template, title });
      router.push(`/store/pages/${p.id}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the page.");
      setBusy(false);
    }
  }

  return (
    <>
      <title>Store pages · PowerProof</title>
      <PageHeader
        title="Store pages"
        description="Pages you design block by block: a sale, your story, a link-in-bio. Edit freely; buyers only see what you publish."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> New page
          </Button>
        }
      />
      <p className="-mt-2 mb-6 text-sm text-muted-foreground">
        Looking for About, FAQ or your policies?{" "}
        <Link href="/store/info" className="font-medium text-primary underline underline-offset-4">
          Edit them here
        </Link>
        .
      </p>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-card" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState icon={FileText} title="No pages yet" body="Start from a template. You can change everything." action={<Button onClick={() => setCreating(true)}><Plus aria-hidden /> New page</Button>} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-card border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`/store/pages/${p.id}/edit`} className="inline-flex min-h-11 items-center font-display text-lg font-extrabold [overflow-wrap:anywhere] hover:underline">
                    {p.title}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{storeUrl(store.data?.slug ?? "store")}/p/{p.slug}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`More for ${p.title}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/store/pages/${p.id}/versions`}>
                        <History aria-hidden /> Versions
                      </Link>
                    </DropdownMenuItem>
                    {p.status !== "draft" && store.data && (
                      <DropdownMenuItem asChild>
                        <a href={`/s/${store.data.slug}/p/${p.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink aria-hidden /> View live
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={async () => {
                        await duplicateVisualPage(p.id);
                        toast.success("Copy made", { description: "It's a draft until you publish it." });
                        reload();
                      }}
                    >
                      <Copy aria-hidden /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-danger" onSelect={() => setToDelete(p)}>
                      <Trash2 aria-hidden /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusPill status={p.status} label={STATUS[p.status][0]} tone={STATUS[p.status][1]} />
                <span>{p.sections} section{p.sections === 1 ? "" : "s"}</span>
                <span>· Edited {formatDate(p.updatedAt)}</span>
              </div>
              <Button asChild variant="secondary" className="mt-auto self-start">
                <Link href={`/store/pages/${p.id}/edit`}>
                  <Pencil aria-hidden /> Edit page
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={(o) => !busy && setCreating(o)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New page</DialogTitle>
            <DialogDescription>Pick a starting point. Every block can be changed or removed.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-title">Page name</Label>
            <Input id="np-title" value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(undefined); }} placeholder="Diwali sale" aria-invalid={!!titleError || undefined} aria-describedby={titleError ? "np-title-err" : undefined} />
            {titleError && <p id="np-title-err" className="text-sm font-medium text-danger">{titleError}</p>}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Template</legend>
            <RadioGroup value={template} onValueChange={setTemplate} aria-label="Template" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {templates.map((t) => (
                <label key={t.id} htmlFor={`tpl-${t.id}`} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-control border bg-surface p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
                  <RadioGroupItem id={`tpl-${t.id}`} value={t.id} className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />} Create and edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
