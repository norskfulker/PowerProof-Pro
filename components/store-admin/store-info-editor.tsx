"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Plus, RotateCcw, Trash2 } from "lucide-react";
import { MediaUploader } from "@/components/media/media-uploader";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { SaveBar } from "@/components/save/save-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { getStoreInfo, STORE_PAGE_LABELS, updateStorePage, type StoreInfo } from "@/lib/api";
import { defaultStorePages } from "@/lib/api";
import { uid } from "@/lib/uid";
import type { AboutContent, FaqItem, StorePageKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const KEYS: StorePageKey[] = ["about", "faq", "refund", "terms", "privacy"];

export function pageHref(storeId: string, key: StorePageKey) {
  return key === "about" || key === "faq" ? `/store/${storeId}/pages/${key}` : `/store/${storeId}/pages/policies/${key}`;
}

function publicHref(slug: string, key: StorePageKey) {
  return key === "about" || key === "faq" ? `/s/${slug}/${key}` : `/s/${slug}/policies/${key}`;
}

function NotEdited({ edited }: { edited?: boolean }) {
  if (edited) return null;
  return <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">Not edited yet</span>;
}

function AboutForm({ info, onSaved }: { info: StoreInfo; onSaved: (i: StoreInfo) => void }) {
  const [value, setValue] = useState<AboutContent>(info.about);
  const state = useDirtyForm({
    value,
    saved: info.about,
    onSave: async (v) => onSaved(await updateStorePage(info.store.id, { key: "about", about: v })),
    onDiscard: () => setValue(info.about),
    savedMessage: "About page saved",
  });
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ab-name">Your name</Label>
          <Input id="ab-name" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ab-loc">Where you are</Label>
          <Input id="ab-loc" value={value.location} onChange={(e) => setValue({ ...value, location: e.target.value })} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-story">Your story</Label>
        <Textarea id="ab-story" rows={8} value={value.story} onChange={(e) => setValue({ ...value, story: e.target.value })} />
      </div>
      <MediaUploader label="Photo of you (optional)" kinds={["image"]} aspect="1:1" aiPurpose="social_post" value={value.photo} onChange={(photo) => setValue({ ...value, photo })} />
      <SaveBar state={state} className="md:order-first md:self-end" />
    </div>
  );
}

function FaqForm({ info, onSaved }: { info: StoreInfo; onSaved: (i: StoreInfo) => void }) {
  const [items, setItems] = useState<FaqItem[]>(info.pages.faq);
  const state = useDirtyForm({
    value: items,
    saved: info.pages.faq,
    onSave: async (v) => onSaved(await updateStorePage(info.store.id, { key: "faq", faq: v })),
    onDiscard: () => setItems(info.pages.faq),
    savedMessage: "FAQ saved",
  });
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setItems(next);
  };
  return (
    <div className="flex flex-col gap-4">
      <SaveBar state={state} className="md:self-end" />
      <ol className="flex flex-col gap-3">
        {items.map((f, i) => (
          <li key={f.id} className="flex flex-col gap-2 rounded-card border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Question {i + 1}</span>
              <div className="flex gap-1 pointer-coarse:gap-2">
                <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move question ${i + 1} up`}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move question ${i + 1} down`}><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setItems(items.filter((x) => x.id !== f.id))} aria-label={`Delete question ${i + 1}`}><Trash2 /></Button>
              </div>
            </div>
            <Label htmlFor={`fq-${f.id}`} className="sr-only">Question {i + 1}</Label>
            <Input id={`fq-${f.id}`} value={f.q} placeholder="Question" onChange={(e) => setItems(items.map((x) => (x.id === f.id ? { ...x, q: e.target.value } : x)))} />
            <Label htmlFor={`fa-${f.id}`} className="sr-only">Answer {i + 1}</Label>
            <Textarea id={`fa-${f.id}`} rows={3} value={f.a} placeholder="Answer" onChange={(e) => setItems(items.map((x) => (x.id === f.id ? { ...x, a: e.target.value } : x)))} />
          </li>
        ))}
      </ol>
      <Button type="button" variant="secondary" className="self-start" onClick={() => setItems([...items, { id: uid("faq"), q: "", a: "" }])}>
        <Plus aria-hidden /> Add a question
      </Button>
    </div>
  );
}

function PolicyForm({ info, k, onSaved }: { info: StoreInfo; k: "refund" | "terms" | "privacy"; onSaved: (i: StoreInfo) => void }) {
  const saved = info.pages[k];
  const [text, setText] = useState(saved);
  const state = useDirtyForm({
    value: text,
    saved,
    onSave: async (v) => onSaved(await updateStorePage(info.store.id, { key: k, text: v })),
    onDiscard: () => setText(saved),
    savedMessage: `${STORE_PAGE_LABELS[k]} saved`,
  });
  const fallback = defaultStorePages(info.store)[k];
  return (
    <div className="flex flex-col gap-4">
      <SaveBar state={state} className="md:self-end" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`pol-${k}`}>{STORE_PAGE_LABELS[k]}</Label>
        <Textarea id={`pol-${k}`} rows={12} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={`pol-${k}-hint`} />
        <p id={`pol-${k}-hint`} className="text-xs text-muted-foreground">Plain words work best. Buyers read this before they pay.</p>
      </div>
      {text !== fallback && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setText(fallback)}>
          <RotateCcw aria-hidden /> Use the default text
        </Button>
      )}
    </div>
  );
}

/** One store's About, FAQ and policies, each page with its own save bar (Part 6C). */
export function StoreInfoEditor({ storeId, page }: { storeId: string; page: StorePageKey }) {
  const { data, error, reload, setData } = useApi(() => getStoreInfo(storeId), [storeId]);
  return (
    <>
      <PageHeader title="About, FAQ and policies" description="Each store has its own. Nothing here is shared with your other stores." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-96 rounded-card" />
      ) : (
        <>
          <nav aria-label="Store pages" className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {KEYS.map((k) => (
              <Link
                key={k}
                href={pageHref(storeId, k)}
                aria-current={page === k ? "page" : undefined}
                className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border px-3 text-sm font-medium", page === k ? "border-primary bg-primary-soft text-primary" : "bg-surface hover:border-border-strong")}
              >
                {STORE_PAGE_LABELS[k]}
                <NotEdited edited={data.pages.edited?.[k]} />
              </Link>
            ))}
          </nav>
          <section aria-labelledby="sp-title" className="rounded-card border bg-surface p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h2 id="sp-title" className="text-xl">{STORE_PAGE_LABELS[page]}</h2>
              <NotEdited edited={data.pages.edited?.[page]} />
              <Link href={publicHref(data.store.slug, page)} target="_blank" className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
                <ExternalLink className="size-4" aria-hidden /> View on store
              </Link>
            </div>
            {page === "about" && <AboutForm key={storeId} info={data} onSaved={setData} />}
            {page === "faq" && <FaqForm key={storeId} info={data} onSaved={setData} />}
            {(page === "refund" || page === "terms" || page === "privacy") && <PolicyForm key={`${storeId}-${page}`} info={data} k={page} onSaved={setData} />}
          </section>
        </>
      )}
    </>
  );
}
