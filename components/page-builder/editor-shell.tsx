"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CloudOff, ExternalLink, History, Layers, Loader2, Plus, Redo2, Settings2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { discardVisualDraft, publishVisualPage, saveVisualDraft, updateVisualPageMeta, type RenderContext, type VisualPageStatus } from "@/lib/api";
import { BLOCK_LABELS } from "@/lib/pages/editor-store";
import type { BlockType, StorePageDoc } from "@/lib/pages/schema";
import { cn } from "@/lib/utils";
import { AddBlockMenu } from "./add-block-menu";
import { Canvas } from "./canvas";
import { DevicePreviewSwitch } from "./device-preview-switch";
import { EditorProvider, useEditor, useEditorStore } from "./editor-context";
import { LayersPanel } from "./layers-panel";
import { SettingsPanel } from "./settings-panel";

type SaveState = "saved" | "saving" | "error";
type Panel = "add" | "layers" | "settings";

const AUTOSAVE_MS = 1200;

function isTyping(el: Element | null) {
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable);
}

function SaveIndicator({ state, at, onRetry }: { state: SaveState; at?: string; onRetry: () => void }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      {state === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="size-3.5 text-success" aria-hidden /> Draft saved{at ? ` ${new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}
        </>
      )}
      {state === "error" && (
        <>
          <CloudOff className="size-3.5 text-danger" aria-hidden /> Not saved.{" "}
          <button type="button" onClick={onRetry} className="inline-flex min-h-8 items-center font-semibold text-primary underline underline-offset-4 pointer-coarse:min-h-11">
            Retry
          </button>
        </>
      )}
    </p>
  );
}

function Inner({ page, context }: { page: StorePageDoc; context: RenderContext }) {
  const store = useEditorStore();
  const rev = useEditor((s) => s.rev);
  const savedRev = useEditor((s) => s.savedRev);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const device = useEditor((s) => s.device);
  const focusSection = useEditor((s) => s.focusSection);
  const compare = useEditor((s) => s.compare);
  const selectedId = useEditor((s) => s.selectedId);
  const { undo, redo, setDevice, setFocusSection, setCompare, insert, reset, markSaved } = store.getState();

  const [title, setTitle] = useState(page.title);
  // Creators check both themes without changing the store's own default
  const [previewAs, setPreviewAs] = useState<"light" | "dark">(() => (context.theme.mode === "dark" ? "dark" : "light"));
  const [published, setPublished] = useState(page.published);
  const [status, setStatus] = useState<VisualPageStatus>(page.published ? "published" : "draft");
  const [save, setSave] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(page.updatedAt);
  const [publishing, setPublishing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [sheet, setSheet] = useState<Panel | null>(null);
  const [leftTab, setLeftTab] = useState<"add" | "layers">("add");
  const saving = useRef<Promise<void> | null>(null);

  const flush = useCallback(async () => {
    const s = store.getState();
    if (s.rev === s.savedRev) return;
    const at = s.rev;
    setSave("saving");
    const p = saveVisualDraft(page.id, s.doc)
      .then((r) => {
        markSaved(at);
        setSavedAt(r.updatedAt);
        setStatus(r.status);
        setSave("saved");
      })
      .catch(() => setSave("error"));
    saving.current = p;
    await p;
  }, [store, page.id, markSaved]);

  // Autosave a moment after the last change
  useEffect(() => {
    if (rev === savedRev) return;
    const t = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [rev, savedRev, flush]);

  // In-app links ask before leaving while an autosave is still pending
  const unsaved = useUnsavedGuard();
  const guardId = useId();
  useEffect(() => {
    unsaved.set(guardId, rev !== savedRev);
    return () => unsaved.set(guardId, false);
  }, [unsaved, guardId, rev, savedRev]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      const s = store.getState();
      if (s.rev !== s.savedRev) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [store]);

  // Undo, redo, delete, escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = isTyping(document.activeElement);
      if (mod && !typing && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.getState().redo();
        else store.getState().undo();
      } else if (mod && !typing && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.getState().redo();
      } else if (!typing && (e.key === "Delete" || e.key === "Backspace") && store.getState().selectedId && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        store.getState().remove(store.getState().selectedId!);
      } else if (e.key === "Escape" && !typing && !document.querySelector("[role=dialog]")) {
        store.getState().select(undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  function add(type: BlockType) {
    const id = insert(type);
    if (!id) return toast.error(type === "section" || type === "hero" ? "That's 40 sections, the most a page can have." : `A ${BLOCK_LABELS[type].toLowerCase()} can't go there. Select a section first.`);
    setSheet(null);
    toast.success(`${BLOCK_LABELS[type]} added`, { duration: 1500 });
  }

  async function publish() {
    setPublishing(true);
    try {
      await flush();
      if (store.getState().rev !== store.getState().savedRev) throw new Error("Save didn't finish. Try again.");
      const p = await publishVisualPage(page.id);
      setPublished(p.published);
      setStatus("published");
      toast.success("Published", { description: "Buyers see the new version now." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't publish. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function discard() {
    const p = await discardVisualDraft(page.id);
    reset(p.draft);
    setStatus("published");
    toast.success("Changes discarded");
  }

  const livePath = `/s/${context.store.slug}/p/${page.slug}`;
  const statusText = status === "draft" ? "Not published" : status === "changed" ? "Unpublished changes" : "Live";

  const panels = {
    add: <AddBlockMenu onAdd={add} />,
    layers: <LayersPanel />,
    settings: <SettingsPanel context={context} />,
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface px-3 py-2 md:px-4">
        <Button asChild variant="ghost" size="icon" aria-label="Back to store pages">
          <Link href="/store/current/design/pages">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-[1_1_12rem] flex-col">
          <label htmlFor="vp-title" className="sr-only">Page name</label>
          <Input
            id="vp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== page.title && updateVisualPageMeta(page.id, { title }).catch(() => toast.error("Couldn't rename the page."))}
            className="h-9 max-w-md border-transparent bg-transparent px-2 font-display text-lg font-extrabold hover:border-input pointer-coarse:h-11"
          />
          <div className="flex flex-wrap items-center gap-x-3 px-2">
            <span className={cn("text-xs font-semibold", status === "published" ? "text-success" : status === "changed" ? "text-warning-ink" : "text-muted-foreground")}>{statusText}</span>
            <SaveIndicator state={save} at={savedAt} onRetry={flush} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="History" className="flex gap-1 pointer-coarse:gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo (Ctrl Z)">
              <Undo2 />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo (Ctrl Shift Z)">
              <Redo2 />
            </Button>
          </div>
          <DevicePreviewSwitch value={device} onChange={setDevice} className="max-md:hidden" />
          <Segmented
            label="Preview as"
            value={previewAs}
            onChange={setPreviewAs}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            className="max-sm:hidden"
          />
          <Segmented
            label="Preview"
            value={focusSection ? "section" : "page"}
            onChange={(v) => setFocusSection(v === "section")}
            options={[
              { value: "page", label: "Full page" },
              { value: "section", label: "This section" },
            ]}
            className="max-lg:hidden"
          />
          <label className="flex min-h-11 items-center gap-2 text-sm max-xl:hidden">
            <Switch checked={compare} onCheckedChange={setCompare} aria-label="Before and after" />
            Before and after
          </label>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/store/current/design/pages/${page.id}/versions`}>
              <History aria-hidden /> <span className="max-sm:sr-only">Versions</span>
            </Link>
          </Button>
          {published && (
            <Button asChild variant="ghost" size="sm" className="max-md:hidden">
              <a href={livePath} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden /> View live
              </a>
            </Button>
          )}
          {status === "changed" && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setDiscardOpen(true)}>
              Discard
            </Button>
          )}
          {status === "published" && rev === savedRev && !publishing ? (
            <span className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm font-medium text-success" role="status">
              <Check className="size-4" aria-hidden /> Live
            </span>
          ) : (
            <Button type="button" onClick={publish} disabled={publishing}>
              {publishing && <Loader2 className="animate-spin" aria-hidden />}
              {status === "draft" ? "Publish" : "Publish changes"}
            </Button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <aside aria-label="Add and layers" className="hidden min-h-0 flex-col border-r bg-surface lg:flex">
          <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as "add" | "layers")} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-3 mt-3 grid grid-cols-2">
              <TabsTrigger value="add">
                <Plus aria-hidden /> Add
              </TabsTrigger>
              <TabsTrigger value="layers">
                <Layers aria-hidden /> Layers
              </TabsTrigger>
            </TabsList>
            <TabsContent value="add" className="min-h-0 flex-1 overflow-y-auto p-3">
              {panels.add}
            </TabsContent>
            <TabsContent value="layers" className="min-h-0 flex-1 overflow-y-auto p-3">
              {panels.layers}
            </TabsContent>
          </Tabs>
        </aside>

        <main id="main" className="min-h-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <Canvas context={context} published={published} previewAs={previewAs} />
        </main>

        <aside aria-label="Block settings" className="hidden min-h-0 overflow-y-auto border-l bg-surface p-4 lg:block">
          {panels.settings}
        </aside>
      </div>

      {/* Phones and tablets: panels as bottom sheets */}
      <nav aria-label="Editor tools" className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around gap-2 border-t bg-surface px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden">
        {(
          [
            ["add", "Add", Plus],
            ["layers", "Layers", Layers],
            ["settings", "Edit", Settings2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSheet(id)}
            disabled={id === "settings" && !selectedId}
            className="flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-control px-2 text-xs font-medium disabled:opacity-40"
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
        <DevicePreviewSwitch value={device} onChange={setDevice} className="md:hidden" />
      </nav>
      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-dialog p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="font-display text-lg">{sheet === "add" ? "Add a block" : sheet === "layers" ? "Layers" : "Edit block"}</SheetTitle>
          <SheetDescription className="sr-only">{sheet === "add" ? "Pick a block to add to the page" : sheet === "layers" ? "Every block on the page" : "Settings for the selected block"}</SheetDescription>
          <div className="mt-3">{sheet && panels[sheet]}</div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard your changes?"
        description="The draft goes back to the published page. You can still find older versions in Versions."
        confirmLabel="Discard changes"
        onConfirm={discard}
      />
    </div>
  );
}

/** The visual editor for one store page. */
export function EditorShell({ page, context }: { page: StorePageDoc; context: RenderContext }) {
  return (
    <EditorProvider initial={page.draft}>
      <Inner page={page} context={context} />
    </EditorProvider>
  );
}
