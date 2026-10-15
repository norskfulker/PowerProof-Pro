"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CloudOff, ExternalLink, Eye, Files, History, EyeOff, LayoutList, Loader2, Palette, PanelLeftClose, PanelRightClose, PanelRightOpen, Redo2, Settings2, Sparkles, Undo2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuestionsInbox } from "@/components/store-admin/questions-inbox";
import { ReviewsInbox } from "@/components/store-admin/reviews-inbox";
import { discardEditorDraft, getPayoutMethods, getProducts, getStoreInfo, pageUrl, publishEditor, saveEditorDraft, type EditorSession, type RenderContext, type VisualPageStatus } from "@/lib/api";
import { launchChecks, type LaunchIssue } from "@/lib/pages/launch-check";
import { EDITOR_PANELS, PREVIEW_CHANNEL, type EditorPanel, type SiteDraft } from "@/lib/pages/editor-store";
import type { AboutContent, FaqItem } from "@/lib/types";
import { HOME_TEMPLATE } from "@/lib/pages/templates";
import { cn } from "@/lib/utils";
import { AddPicker } from "./add-block-menu";
import { AiBuilder } from "./ai-builder";
import { Canvas, CanvasIconPicker } from "./canvas";
import { ContentPanel } from "./content-panel";
import { CopyLookDialog } from "./copy-look-dialog";
import { DevicePreviewSwitch } from "./device-preview-switch";
import { EditorProvider, useEditor, useEditorStore } from "./editor-context";
import { LaunchCheckDialog } from "./launch-check-dialog";
import { LayersPanel, nodeLabel } from "./layers-panel";
import { LinkPrompt } from "./link-prompt";
import { PagesPanel } from "./pages-panel";
import { SettingsPanel } from "./settings-panel";
import { ThemeSettingsPanel } from "./theme-settings";

type SaveState = "saved" | "saving" | "error";

/** The editor's side panels, in the rail's order. About, reviews and questions live under the Policies tab and open here as panels. */
const RAIL: { id: EditorPanel; label: string; title: string; icon: LucideIcon; data?: true }[] = [
  { id: "sections", label: "Sections", title: "Sections", icon: LayoutList },
  { id: "pages", label: "Pages", title: "Pages", icon: Files, data: true },
  { id: "theme", label: "Theme", title: "Theme settings", icon: Palette },
  { id: "edit", label: "Edit", title: "Edit", icon: Settings2 },
];
/** Titles for panels opened without a rail button (About, Reviews, Questions from the Policies tab) */
const PANEL_TITLES: Record<EditorPanel, string> = {
  sections: "Sections",
  pages: "Pages",
  theme: "Theme settings",
  content: "About and FAQ",
  reviews: "Reviews",
  questions: "Questions",
  edit: "Edit",
};
const DATA_PANELS = new Set(RAIL.filter((r) => r.data).map((r) => r.id));

/** Drafts save almost as you type: a short pause batches a burst of keystrokes into one save */
const AUTOSAVE_MS = 400;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function isTyping(el: EventTarget | Element | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
}

function SaveIndicator({ state, at, onRetry }: { state: SaveState; at?: string; onRetry: () => void }) {
  return (
    <p className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground" role="status" aria-live="polite">
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

const editHref = (id: string) => `/store/current/design/pages/${id}/edit`;

/** The app's own top bar, which the editor's bar sits under */
/** The app's bar above the editor: shown on phones only (the editor's own bar replaces it on desktop) */
const appBar = () => (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? 0 : 64);

function Inner({ session }: { session: EditorSession }) {
  const { page, pages } = session;
  // The store's own data (About, FAQ, reviews) is edited beside the page, so the preview follows it
  const [context, setContext] = useState<RenderContext>(session.context);
  const onAbout = useCallback((about: AboutContent) => setContext((c) => ({ ...c, about })), []);
  const onFaq = useCallback((faq: FaqItem[]) => setContext((c) => ({ ...c, faq })), []);
  const router = useRouter();
  const store = useEditorStore();
  const rev = useEditor((s) => s.rev);
  const savedRev = useEditor((s) => s.savedRev);
  const site = useEditor((s) => s.site);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const device = useEditor((s) => s.device);
  const selectedId = useEditor((s) => s.selectedId);
  const { undo, redo, setDevice, reset, markSaved } = store.getState();

  const isHome = page.template === HOME_TEMPLATE;
  // "Build with AI": opened from the top bar, or straight away when a page was created with AI (?ai=1)
  const search = useSearchParams();
  const [aiOpen, setAiOpen] = useState(() => search.get("ai") === "1");
  const building = useEditor((s) => !!s.aiBase);
  // Creators check both themes without changing the store's own default
  const [previewAs] = useState<"light" | "dark">(() => (session.site.design.theme.mode === "dark" ? "dark" : "light"));
  const [published, setPublished] = useState(page.published);
  const [status, setStatus] = useState<VisualPageStatus>(page.published ? (same(page.draft, page.published) ? "published" : "changed") : "draft");
  const [liveSite, setLiveSite] = useState<SiteDraft>(session.liveSite);
  const [storeLive, setStoreLive] = useState(session.storeLive);
  const [save, setSave] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(page.updatedAt);
  const [publishing, setPublishing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState<LaunchIssue[]>([]);
  const [checkOpen, setCheckOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [sheet, setSheet] = useState<EditorPanel | null>(null);
  const panel = useEditor((s) => s.panel);
  const panelAt = useEditor((s) => s.panelAt);
  const { openPanel } = store.getState();
  // Old addresses (Reviews, Questions, About, FAQ, Pages) open their panel here: ?panel=reviews
  useEffect(() => {
    const want = search.get("panel");
    // From My Store's "Copy a store": the theme panel, with the copy dialog open
    if (search.get("copy") === "1") {
      openPanel("theme");
      store.getState().setCopyLook(true);
    }
    if (want === "about" || want === "faq") openPanel("content", want);
    else if (want && (EDITOR_PANELS as readonly string[]).includes(want)) openPanel(want as EditorPanel);
  }, [search, openPanel, store]);
  // On phones panels are sheets: one opened from elsewhere (a link, a settings button) shows as one
  const narrow = useRef(false);
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (narrow.current && s.panel !== prev.panel && DATA_PANELS.has(s.panel)) setSheet(s.panel);
      }),
    [store]
  );
  // The editor's own width decides its layout (the app's sidebar sits beside it)
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<"wide" | "mid" | "narrow">("wide");
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const next = e.contentRect.width >= 1100 ? "wide" : e.contentRect.width >= 720 ? "mid" : "narrow";
      narrow.current = next === "narrow";
      setSize(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Selecting something on the page shows its settings: the Edit panel in two columns, the
  // settings column (beside the Sections panel) in three
  useEffect(() => {
    if (!selectedId) return;
    const s = store.getState();
    if (size === "mid") s.openPanel("edit");
    else if (DATA_PANELS.has(s.panel)) s.openPanel("sections");
  }, [selectedId, size, store]);
  const tab: EditorPanel = size !== "mid" && panel === "edit" ? "sections" : panel;
  const wideData = DATA_PANELS.has(tab);
  // The editor's bar sticks under the app's; the side panels stick under both
  const bar = useRef<HTMLElement>(null);
  const [barHeight, setBarHeight] = useState(56);
  // Either sidebar collapses; the canvas takes the room
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const leftShown = size !== "narrow" && leftOpen;
  const rightShown = size === "wide" && !wideData && rightOpen;
  const bodyCols =
    !leftShown && !rightShown ? "grid-cols-1"
    : leftShown && rightShown ? "grid-cols-[21rem_minmax(0,1fr)_19rem]"
    : leftShown ? (wideData ? "grid-cols-[26rem_minmax(0,1fr)]" : "grid-cols-[21rem_minmax(0,1fr)]")
    : "grid-cols-[minmax(0,1fr)_19rem]";
  // Both sidebars pin under the bars with their own scroll, so they stay in view on long pages
  const [above, setAbove] = useState(64);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const on = () => setAbove(appBar());
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  const sideStick: React.CSSProperties = { position: "sticky", top: above + barHeight, maxHeight: `calc(100dvh - ${above + barHeight}px)`, overflowY: "auto" };
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The site settings as last saved, so they're only written when they change
  const savedSite = useRef<SiteDraft | undefined>(session.site);
  const saving = useRef<Promise<void> | null>(null);

  const siteChanged = !!site && !same(site, liveSite);
  const dirty = status !== "published" || siteChanged;

  const flush = useCallback(async () => {
    // One save at a time, in order, so an older save can never land after a newer one
    if (saving.current) await saving.current;
    const s = store.getState();
    // An AI build isn't saved until it is kept
    if (s.rev === s.savedRev || s.aiBase) return;
    const at = s.rev;
    const siteNow = s.site && !same(s.site, savedSite.current) ? s.site : undefined;
    setSave("saving");
    const p = saveEditorDraft(page.id, s.doc, siteNow)
      .then((r) => {
        markSaved(at);
        if (siteNow) savedSite.current = siteNow;
        setSavedAt(r.updatedAt);
        setStatus(r.status);
        setSave("saved");
        // Open preview tabs pick up the new draft
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel(PREVIEW_CHANNEL);
          ch.postMessage(page.id);
          ch.close();
        }
      })
      .catch((e) => {
        setSave("error");
        if (e instanceof Error && /problem/i.test(e.message)) toast.error(e.message);
      });
    saving.current = p;
    await p;
  }, [store, page.id, markSaved]);

  // Autosave a moment after the last change
  useEffect(() => {
    if (rev === savedRev) return;
    const t = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [rev, savedRev, flush]);

  // Leaving the tab, switching apps or closing it: save what's there straight away
  useEffect(() => {
    const now = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const leave = () => void flush();
    document.addEventListener("visibilitychange", now);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", now);
      window.removeEventListener("pagehide", leave);
    };
  }, [flush]);

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

  // Undo, redo, delete, escape: from the editor and from inside the canvas frame
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = isTyping(e.target);
      const dialog = !!document.querySelector("[role=dialog]");
      const s = store.getState();
      // An AI build on screen is kept or discarded from its own bar
      if (s.aiBase) return;
      if (mod && !typing && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && !typing && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      } else if (!typing && (e.key === "Delete" || e.key === "Backspace") && s.selectedId && !s.selectedId.startsWith("@") && !dialog) {
        e.preventDefault();
        s.remove(s.selectedId);
      } else if (e.key === "Escape" && !typing && !dialog) {
        s.select(undefined);
      }
    },
    [store, flush]
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  async function publish() {
    setPublishing(true);
    try {
      await flush();
      if (store.getState().rev !== store.getState().savedRev) throw new Error("Save didn't finish. Try again.");
      const goLive = isHome && !storeLive;
      const p = await publishEditor(page.id, { site: siteChanged ? store.getState().site : undefined, goLive });
      setPublished(p.published);
      setStatus("published");
      if (store.getState().site) {
        setLiveSite(store.getState().site!);
        savedSite.current = undefined;
      }
      if (goLive) setStoreLive(true);
      setCheckOpen(false);
      toast.success(goLive ? "Your store is live" : "Published", { description: goLive ? "Share your link to get your first sale." : "Buyers see the new version now." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't publish. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  /**
   * Publish, after checking what buyers would see: broken links, products that aren't live, empty
   * blocks; and before going live, the store itself. Nothing found: publish straight away (going
   * live always shows the result). If the check can't run, publishing isn't held up.
   */
  async function review() {
    setChecking(true);
    const goingLive = isHome && !storeLive;
    try {
      await flush();
      const st = store.getState();
      const now = st.site ?? liveSite;
      const [products, info, methods] = await Promise.all([
        getProducts(),
        goingLive ? getStoreInfo(context.store.id).catch(() => undefined) : undefined,
        goingLive ? getPayoutMethods().catch(() => undefined) : undefined,
      ]);
      const found = launchChecks({
        doc: st.doc,
        goingLive,
        store: { ...context.store, logo: now.logo },
        theme: now.design.theme,
        products,
        collections: context.collections,
        pages: session.pages.filter((x) => !x.home && x.id !== page.id).map((x) => ({ slug: x.slug, title: x.title, published: x.status !== "draft" })),
        about: now.design.about ?? context.about,
        faq: context.faq,
        policies: info?.pages,
        reviewCount: context.reviews.length,
        payout: methods ? methods.length > 0 : undefined,
        checkColours: goingLive || siteChanged,
        label: nodeLabel,
      });
      setIssues(found);
      if (!found.length && !goingLive) {
        setChecking(false);
        return publish();
      }
      setCheckOpen(true);
    } catch {
      setChecking(false);
      return publish();
    } finally {
      setChecking(false);
    }
  }

  function fixIssue(i: LaunchIssue) {
    setCheckOpen(false);
    if (i.nodeId) {
      store.getState().select(i.nodeId);
      if (size === "narrow") setSheet("edit");
      else openPanel("edit");
    } else if (i.panel) {
      if (size === "narrow") setSheet(i.panel);
      else openPanel(i.panel);
    }
  }

  async function discard() {
    const r = await discardEditorDraft(page.id);
    reset(r.page.draft, r.site);
    savedSite.current = r.site;
    setLiveSite(r.site);
    setStatus(r.page.published ? "published" : "draft");
    toast.success("Changes discarded");
  }

  async function goTo(id: string) {
    if (id === "manage") return size === "narrow" ? setSheet("pages") : openPanel("pages");
    await flush();
    router.push(editHref(id));
  }

  const livePath = pageUrl(context.store.slug, page.slug);
  // Opened straight from the click (so it isn't blocked as a pop-up); pending changes save and the tab follows
  function openPreview() {
    window.open(`/preview/${page.id}`, `pp-preview-${page.id}`);
    void flush();
  }
  const pageTitle = isHome ? "Home page" : page.title;

  const panels: Record<EditorPanel, React.ReactNode> = {
    sections: <LayersPanel pageTitle={pageTitle} pageId={page.id} isHome={isHome} context={context} />,
    pages: <PagesPanel slug={context.store.slug} currentId={page.id} storeLive={storeLive} beforeLeave={flush} />,
    theme: <ThemeSettingsPanel context={context} mode={previewAs} />,
    content: <ContentPanel storeId={context.store.id} slug={context.store.slug} at={panelAt} onAbout={onAbout} onFaq={onFaq} />,
    reviews: <ReviewsInbox compact onChange={(r) => r.hidden && setContext((c) => ({ ...c, reviews: c.reviews.filter((x) => x.id !== r.id) }))} />,
    questions: <QuestionsInbox compact />,
    edit: <SettingsPanel context={context} mode={previewAs} />,
  };
  const railItems = RAIL.filter((r) => r.id !== "edit" || size === "mid");
  const current = RAIL.find((r) => r.id === tab) ?? { id: tab, title: PANEL_TITLES[tab] };

  return (
    <div ref={root} className="-mx-3 flex flex-1 flex-col border-t bg-background md:mx-0 md:border-t-0">
      {/* Top bar: stays in view while the page scrolls */}
      <header ref={bar} data-editor-bar="" className="sticky top-16 z-20 flex h-auto min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface/90 px-3 py-2 backdrop-blur-md md:top-0 md:px-4">
        <div className="flex min-w-0 flex-[1_1_14rem] items-center gap-x-3 gap-y-1 overflow-hidden">
          {size !== "narrow" && <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={() => setLeftOpen((o) => !o)} aria-pressed={leftOpen} aria-label={leftOpen ? "Collapse sidebar" : "Expand sidebar"}><PanelLeftClose className={!leftOpen ? "rotate-180" : undefined} /></Button></TooltipTrigger><TooltipContent>{leftOpen ? "Collapse sidebar" : "Expand sidebar"}</TooltipContent></Tooltip>}
          <Select value={page.id} onValueChange={goTo}>
            <SelectTrigger size="sm" className="h-9 w-auto max-w-60 min-w-0 border-transparent bg-transparent px-2 font-display text-base font-bold hover:border-input" aria-label="Page you're editing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Pages</SelectLabel>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.home ? "Home page" : p.title}
                  </SelectItem>
                ))}
                {!pages.some((p) => p.id === page.id) && <SelectItem value={page.id}>{pageTitle}</SelectItem>}
              </SelectGroup>
              <SelectSeparator />
              <SelectItem value="manage">Manage pages…</SelectItem>
            </SelectContent>
          </Select>
          {isHome && !storeLive && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-warning-ink"><EyeOff className="size-3.5" aria-hidden /> Hidden from buyers</span>}
          <SaveIndicator state={save === "saved" && rev !== savedRev && !building ? "saving" : save} at={savedAt} onRetry={flush} />
        </div>
        <div className="flex flex-[1_1_auto] items-center justify-center">
          <DevicePreviewSwitch value={device} onChange={setDevice} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Undo, redo and versions as one quiet group */}
          <div role="group" aria-label="History" className="flex items-center rounded-control border bg-surface-sunken p-0.5 pointer-coarse:gap-1">
            <Button type="button" variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo || building} aria-label="Undo (Ctrl Z)" title="Undo">
              <Undo2 />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo || building} aria-label="Redo (Ctrl Shift Z)" title="Redo">
              <Redo2 />
            </Button>
            <Button asChild variant="ghost" size="icon-sm" title="Versions">
              <Link href={`/store/current/design/pages/${page.id}/versions`} aria-label="Versions">
                <History aria-hidden />
              </Link>
            </Button>
          </div>
          {/* The draft, full size in a new tab; it follows every save */}
          <Button type="button" variant="secondary" size="sm" onClick={openPreview} title="Preview your draft in a new tab">
            <Eye aria-hidden /> <span className="max-sm:sr-only">Preview</span>
          </Button>
          {published && (
            <Button asChild variant="ghost" size="icon-sm" className="max-md:hidden" title="View live">
              <a href={livePath} target="_blank" rel="noopener noreferrer" aria-label="View live">
                <ExternalLink aria-hidden />
              </a>
            </Button>
          )}
          {published && dirty && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setDiscardOpen(true)} disabled={building}>
              Discard
            </Button>
          )}
          {size === "wide" && !wideData && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setRightOpen((o) => !o)} aria-pressed={rightOpen} title={rightOpen ? "Collapse settings" : "Expand settings"} aria-label={rightOpen ? "Collapse settings" : "Expand settings"}>
              {rightOpen ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
          )}
          <span aria-hidden className="mx-1 h-6 w-px bg-border max-sm:hidden" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setAiOpen(true)} disabled={building} className="text-primary">
            <Sparkles aria-hidden /> <span className="max-sm:sr-only">Build with AI</span>
          </Button>
          {!dirty && rev === savedRev && !publishing && (!isHome || storeLive) ? (
            <span className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm font-medium text-success" role="status">
              <Check className="size-4" aria-hidden /> Live
            </span>
          ) : (
            <Button type="button" onClick={review} disabled={publishing || checking || building} data-coach="publish-store">
              {(publishing || checking) && <Loader2 className="animate-spin" aria-hidden />}
              {isHome && !storeLive ? "Publish and go live" : status === "draft" ? "Publish" : "Publish changes"}
            </Button>
          )}
        </div>
      </header>

      <LaunchCheckDialog open={checkOpen} onOpenChange={setCheckOpen} issues={issues} goingLive={isHome && !storeLive} publishing={publishing} onPublish={publish} onFix={fixIssue} />

      <AiBuilder open={aiOpen} onOpenChange={setAiOpen} pageId={page.id} template={page.template} isHome={isHome} context={context} flush={flush} />

      {/* Body: while AI builds, the page can be looked at (and scrolled) but not changed */}
      <div className={cn("grid flex-1", bodyCols)}>
        {leftShown && (
        <aside inert={building || undefined} aria-label="Editor panels" className={cn(building && "opacity-60", "border-r bg-surface")}>
          <div className="overscroll-contain flex min-h-0 flex-col" style={sideStick}>
          {/* Sections, Pages and Theme as tabs across the top of the panel */}
          <div role="tablist" aria-label="Panels" className="sticky top-0 z-10 flex gap-1 border-b bg-surface/95 px-2 backdrop-blur">
            {railItems.map(({ id, label, title, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`rail-${id}`}
                aria-selected={tab === id}
                aria-controls="rail-panel"
                title={title}
                onClick={() => openPanel(id)}
                disabled={id === "edit" && !selectedId}
                className={cn(
                  "-mb-px inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-40",
                  tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div id="rail-panel" role="tabpanel" aria-labelledby={`rail-${tab}`} className="flex min-w-0 flex-1 flex-col">
            {/* Panels opened from elsewhere (About, Reviews, Questions) name themselves */}
            {!railItems.some((r) => r.id === tab) && <h2 className="px-3 pt-4 pb-2 text-sm font-semibold">{current.title}</h2>}
            <div key={tab} className={cn("py-3", tab === "sections" ? "px-2" : "px-3")}>
              {panels[tab]}
            </div>
          </div>
          </div>
        </aside>
        )}

        <div className={cn("min-w-0", size === "narrow" && "pb-[calc(4.5rem+env(safe-area-inset-bottom))]")}>
          <Canvas context={context} previewAs={previewAs} onKey={onKey} address={`https://powerproof.app/s/${context.store.slug}${page.slug && !isHome ? `/p/${page.slug}` : ""}`} className="min-h-full" />
        </div>

        {rightShown && (
          <aside inert={building || undefined} aria-label="Settings" className={cn("border-l bg-surface", building && "opacity-60")}>
            <div className="overscroll-contain min-h-0 p-4" style={sideStick}>
              {panels.edit}
            </div>
          </aside>
        )}
      </div>

      {/* Phones: panels as bottom sheets */}
      <nav aria-label="Editor tools" className={cn("fixed inset-x-0 bottom-0 z-30 flex items-center justify-around gap-2 border-t bg-surface px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]", size !== "narrow" && "hidden")}>
        {(
          [
            ["sections", "Sections", LayoutList],
            ["pages", "Pages", Files],
            ["theme", "Theme", Palette],
            ["edit", "Edit", Settings2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSheet(id)}
            disabled={id === "edit" && !selectedId}
            className="flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-control px-2 text-xs font-medium disabled:opacity-40"
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-dialog p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="font-display text-lg">{sheet ? PANEL_TITLES[sheet] : ""}</SheetTitle>
          <SheetDescription className="sr-only">Editor panel</SheetDescription>
          <div className="mt-3">
            {sheet && panels[sheet]}
          </div>
        </SheetContent>
      </Sheet>

      <AddPicker context={context} />
      <CanvasIconPicker />
      <CopyLookDialog context={context} />
      <LinkPrompt context={context} pages={pages} pageId={page.id} onLeave={flush} />

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard your changes?"
        description="The page and the store's theme settings go back to what buyers see now. Older versions stay in Versions."
        confirmLabel="Discard changes"
        onConfirm={discard}
      />
    </div>
  );
}

/** The store editor: one page, with the store's theme settings beside it. */
export function EditorShell({ session }: { session: EditorSession }) {
  return (
    <EditorProvider initial={session.page.draft} site={session.site}>
      <Inner session={session} />
    </EditorProvider>
  );
}
