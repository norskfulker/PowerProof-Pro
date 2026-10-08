"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, History, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { ErrorState } from "@/components/pp/empty-state";
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
import { useCurrentStore } from "@/hooks/use-current-store";
import { createVisualPage, deleteVisualPage, duplicateVisualPage, getPageTemplates, getVisualPages, type VisualPageSummary } from "@/lib/api";
import { formatDate, storeUrl } from "@/lib/format";

const STATUS: Record<VisualPageSummary["status"], [string, "success" | "warning" | "neutral"]> = {
  published: ["Live", "success"],
  changed: ["Unpublished changes", "warning"],
  draft: ["Draft", "neutral"],
};

const STARTERS = [
  { template: "launch", title: "Launch page", body: "One product, front and centre, with a clear buy button." },
  { template: "sale", title: "Sale page", body: "A countdown, the products on offer, and one strong button." },
  { template: "bio", title: "Link in bio", body: "A tidy, phone-first list of your best links." },
];

/** Pages that gather people rather than sell: each is ready to publish in a minute. Sign-ups land in Sales › Leads. */
const FUNNELS = [
  { template: "lead", title: "Lead generation", body: "Offer something free for a name and email." },
  { template: "squeeze", title: "Squeeze page", body: "One promise, one form, no menu or footer." },
  { template: "booking", title: "Book a call", body: "An instant calendar: visitors pick a free time." },
  { template: "clickthrough", title: "Click-through page", body: "A short pitch, then one button to the offer." },
];

export default function StorePagesPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useApi(getVisualPages, [], { live: true });
  const store = useCurrentStore();
  const templates = getPageTemplates();
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState(templates[0].id);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<VisualPageSummary>();

  async function start(templateId: string, name: string) {
    setBusy(true);
    try {
      const p = await createVisualPage({ templateId, title: name });
      router.push(`/store/current/design/pages/${p.id}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the page.");
      setBusy(false);
    }
  }

  async function create() {
    if (title.trim().length < 2) return setTitleError("Give the page a name.");
    setBusy(true);
    try {
      const p = await createVisualPage({ templateId: template, title });
      router.push(`/store/current/design/pages/${p.id}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the page.");
      setBusy(false);
    }
  }

  const withTemplate = new Set((data ?? []).map((p) => p.template));
  const starters = [...STARTERS, ...FUNNELS].filter((s) => !withTemplate.has(s.template));
  const base = storeUrl(store.data?.slug ?? "store");

  return (
    <>
      <title>Pages · PowerProof</title>
      <PageHeader
        title="Pages"
        description="Pages built on your base design. Buyers only see what you publish."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> Add page
          </Button>
        }
      />
      <p className="-mt-2 mb-6 text-sm text-muted-foreground">
        Looking for About, FAQ or your policies?{" "}
        <Link href="/store/current/pages/about" className="font-medium text-primary underline underline-offset-4">
          Edit them here
        </Link>
        .
      </p>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-card" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <li className="flex min-h-44 flex-col gap-3 rounded-card border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="font-display text-lg font-extrabold">Home</h2>
                <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{base}</p>
              </div>
              <StatusPill status={store.data?.onboarded ? "published" : "draft"} label={store.data?.onboarded ? "Live" : "Draft"} tone={store.data?.onboarded ? "success" : "neutral"} />
            </div>
            <p className="text-sm text-muted-foreground">Your store&apos;s main page.</p>
            <Button asChild variant="secondary" className="mt-auto self-start">
              <Link href="/store/current/design/base"><Pencil aria-hidden /> Edit</Link>
            </Button>
          </li>
          {(data ?? []).map((p) => (
            <li key={p.id} className="flex min-h-44 flex-col gap-3 rounded-card border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="font-display text-lg font-extrabold [overflow-wrap:anywhere]">{p.title}</h2>
                  <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{base}/p/{p.slug}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`More for ${p.title}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/store/current/design/pages/${p.id}/versions`}>
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
                <span>Edited {formatDate(p.updatedAt)}</span>
              </div>
              <Button asChild variant="secondary" className="mt-auto self-start">
                <Link href={`/store/current/design/pages/${p.id}/edit`}>
                  <Pencil aria-hidden /> Edit
                </Link>
              </Button>
            </li>
          ))}
          {starters.map((s) => (
            <li key={s.template} className="flex min-h-44 flex-col gap-3 rounded-card border border-dashed bg-surface p-4">
              <h2 className="font-display text-lg font-extrabold">{s.title}</h2>
              <p className="text-sm text-muted-foreground">{s.body}</p>
              <Button variant="secondary" className="mt-auto self-start" disabled={busy} onClick={() => start(s.template, s.title)}>
                <Plus aria-hidden /> Create
              </Button>
            </li>
          ))}
          <li className="flex min-h-44 flex-col gap-3 rounded-card border border-dashed bg-surface p-4">
            <h2 className="font-display text-lg font-extrabold">Add page</h2>
            <p className="text-sm text-muted-foreground">A blank page, or start from a template.</p>
            <Button variant="secondary" className="mt-auto self-start" onClick={() => setCreating(true)}>
              <Plus aria-hidden /> Add page
            </Button>
          </li>
        </ul>
      )}

      <Dialog open={creating} onOpenChange={(o) => !busy && setCreating(o)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add page</DialogTitle>
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
