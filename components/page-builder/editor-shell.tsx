"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpenText, Check, CloudOff, ExternalLink, Files, History, LayoutList, Loader2, MessagesSquare, MoreHorizontal, Palette, Redo2, Settings2, Sparkles, Star, Undo2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useNav } from "@/components/nav/use-nav";
import { QuestionsInbox } from "@/components/store-admin/questions-inbox";
import { ReviewsInbox } from "@/components/store-admin/reviews-inbox";
import { discardEditorDraft, getPayoutMethods, getProducts, getStoreInfo, pageUrl, publishEditor, saveEditorDraft, type EditorSession, type RenderContext, type VisualPageStatus } from "@/lib/api";
import { launchChecks, type LaunchIssue } from "@/lib/pages/launch-check";
import { flattenNav } from "@/lib/nav/model";
import { EDITOR_PANELS, type EditorPanel, type SiteDraft } from "@/lib/pages/editor-store";
import type { AboutContent, FaqItem } from "@/lib/types";
import { HOME_TEMPLATE } from "@/lib/pages/templates";
import { cn } from "@/lib/utils";
import { AddPicker } from "./add-block-menu";
import { AiBuilder } from "./ai-builder";
import { Canvas, CanvasIconPicker } from "./canvas";
import { ContentPanel } from "./content-panel";
import { DevicePreviewSwitch } from "./device-preview-switch";
import { EditorProvider, useEditor, useEditorStore } from "./editor-context";
import { LaunchCheckDialog } from "./launch-check-dialog";
import { LayersPanel, nodeLabel } from "./layers-panel";
import { LinkPrompt } from "./link-prompt";
import { PagesPanel } from "./pages-panel";
import { SettingsPanel } from "./settings-panel";
import { ThemeSettingsPanel } from "./theme-settings";

type SaveState = "saved" | "saving" | "error";

/** The editor's side panels, in the rail's order. Store data panels are wider and hide the block settings column. */
const RAIL: { id: EditorPanel; label: string; title: string; icon: LucideIcon; data?: true }[] = [
  { id: "sections", label: "Sections", title: "Sections", icon: LayoutList },
  { id: "pages", label: "Pages", title: "Pages", icon: Files, data: true },
  { id: "theme", label: "Theme", title: "Theme settings", icon: Palette },
  { id: "content", label: "About", title: "About and FAQ", icon: BookOpenText, data: true },
  { id: "reviews", label: "Reviews", title: "Reviews", icon: Star, data: true },
  { id: "questions", label: "Q&A", title: "Questions", icon: MessagesSquare, data: true },
  { id: "edit", label: "Edit", title: "Edit", icon: Settings2 },
];
const DATA_PANELS = new Set(RAIL.filter((r) => r.data).map((r) => r.id));

const AUTOSAVE_MS = 1200;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function isTyping(el: EventTarget | Element | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
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

const editHref = (id: string) => `/store/current/design/pages/${id}/edit`;

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
  const focusSection = useEditor((s) => s.focusSection);
  const compare = useEditor((s) => s.compare);
  const selectedId = useEditor((s) => s.selectedId);
  const { undo, redo, setDevice, setFocusSection, setCompare, reset, markSaved } = store.getState();

  const isHome = page.template === HOME_TEMPLATE;
  // "Build with AI": opened from the top bar, or straight away when a page was created with AI (?ai=1)
  const search = useSearchParams();
  const [aiOpen, setAiOpen] = useState(() => search.get("ai") === "1");
  const building = useEditor((s) => !!s.aiBase);
  // Creators check both themes without changing the store's own default
  const [previewAs, setPreviewAs] = useState<"light" | "dark">(() => (session.site.design.theme.mode === "dark" ? "dark" : "light"));
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
  const [sheet, setSheet] = useState<EditorPanel | "more" | null>(null);
  const panel = useEditor((s) => s.panel);
  const panelAt = useEditor((s) => s.panelAt);
  const { openPanel } = store.getState();
  // Old addresses (Reviews, Questions, About, FAQ, Pages) open their panel here: ?panel=reviews
  useEffect(() => {
    const want = search.get("panel");
    if (want === "about" || want === "faq") openPanel("content", want);
    else if (want && (EDITOR_PANELS as readonly string[]).includes(want)) openPanel(want as EditorPanel);
  }, [search, openPanel]);
  // On phones panels are sheets: one opened from elsewhere (a link, a settings button) shows as one
  const narrow = useRef(false);
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (narrow.current && s.panel !== prev.panel && DATA_PANELS.has(s.panel)) setSheet(s.panel);
      }),
    [store]
  );
  const { storeTabs } = useNav("creator");
  const counts = Object.fromEntries(flattenNav(storeTabs).filter((n) => n.count).map((n) => [n.id, n.count!]));
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
  // The site settings as last saved, so they're only written when they change
  const savedSite = useRef<SiteDraft | undefined>(session.site);
  const saving = useRef<Promise<void> | null>(null);

  const siteChanged = !!site && !same(site, liveSite);
  const dirty = status !== "published" || siteChanged;

  const flush = useCallback(async () => {
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
  const statusText = status === "draft" ? (isHome ? "Not published yet" : "Not published") : dirty ? "Unpublished changes" : "Live";
  const pageTitle = isHome ? "Home page" : page.title;

  const panels: Record<EditorPanel, React.ReactNode> = {
    sections: <LayersPanel pageTitle={pageTitle} />,
    pages: <PagesPanel slug={context.store.slug} currentId={page.id} storeLive={storeLive} beforeLeave={flush} />,
    theme: <ThemeSettingsPanel context={context} mode={previewAs} />,
    content: <ContentPanel storeId={context.store.id} slug={context.store.slug} at={panelAt} onAbout={onAbout} onFaq={onFaq} />,
    reviews: <ReviewsInbox compact onChange={(r) => r.hidden && setContext((c) => ({ ...c, reviews: c.reviews.filter((x) => x.id !== r.id) }))} />,
    questions: <QuestionsInbox compact />,
    edit: <SettingsPanel context={context} mode={previewAs} />,
  };
  const railItems = RAIL.filter((r) => r.id !== "edit" || size === "mid");
  const current = RAIL.find((r) => r.id === tab)!;

  return (
    <div ref={root} className="-mx-3 flex min-h-0 flex-1 flex-col overflow-hidden border-t bg-background md:mx-0 md:rounded-t-card md:border-x">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface px-3 py-2 md:px-4">
        <Button asChild variant="ghost" size="icon" aria-label="Leave the editor">
          <Link href="/dashboard">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
          <Select value={page.id} onValueChange={goTo}>
            <SelectTrigger size="sm" className="h-9 w-full max-w-72 border-transparent bg-transparent px-2 font-display text-base font-extrabold hover:border-input" aria-label="Page you're editing">
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
          <div className="flex flex-wrap items-center gap-x-3 px-2">
            <span className={cn("text-xs font-semibold", !dirty ? "text-success" : status === "draft" ? "text-muted-foreground" : "text-warning-ink")}>{statusText}</span>
            {isHome && !storeLive && <span className="text-xs font-semibold text-muted-foreground">· Store hidden from buyers</span>}
            <SaveIndicator state={save} at={savedAt} onRetry={flush} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setAiOpen(true)} disabled={building} className="border-primary/40 text-primary">
            <Sparkles aria-hidden /> <span className="max-sm:sr-only">Build with AI</span>
          </Button>
          <div role="group" aria-label="History" className="flex gap-1 pointer-coarse:gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={undo} disabled={!canUndo || building} aria-label="Undo (Ctrl Z)">
              <Undo2 />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={redo} disabled={!canRedo || building} aria-label="Redo (Ctrl Shift Z)">
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
            className="max-xl:hidden"
          />
          <label className="flex min-h-11 items-center gap-2 text-sm max-2xl:hidden">
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
          {published && dirty && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setDiscardOpen(true)} disabled={building}>
              Discard
            </Button>
          )}
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
      <div className={cn("grid min-h-0 flex-1", size === "narrow" ? "grid-cols-1" : wideData ? "grid-cols-[26rem_minmax(0,1fr)]" : size === "wide" ? "grid-cols-[21rem_minmax(0,1fr)_19rem]" : "grid-cols-[21rem_minmax(0,1fr)]")}>
        <aside inert={building || undefined} aria-label="Editor panels" className={cn(building && "opacity-60", "min-h-0 border-r bg-surface", size === "narrow" ? "hidden" : "flex")}>
          <div role="tablist" aria-label="Panels" aria-orientation="vertical" className="flex w-16 shrink-0 flex-col gap-1 overflow-y-auto border-r px-1 py-2">
            {railItems.map(({ id, label, title, icon: Icon }) => {
              const count = id === "reviews" ? counts.reviews : id === "questions" ? counts.questions : undefined;
              return (
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
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-control text-[0.6875rem] leading-none font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
                    tab === id && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary"
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                  {!!count && (
                    <span className="absolute top-1 right-1 min-w-4 rounded-full bg-primary px-1 text-center font-mono text-[0.625rem] leading-4 text-primary-foreground">
                      <span className="sr-only">, </span>
                      {count > 99 ? "99+" : count}
                      <span className="sr-only"> waiting</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div id="rail-panel" role="tabpanel" aria-labelledby={`rail-${tab}`} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <h2 className="px-3 pt-3 pb-2 font-display text-base font-extrabold">{current.title}</h2>
            <div key={tab} className={cn("min-h-0 flex-1 overflow-y-auto pb-3", tab === "sections" ? "px-2" : "px-3")}>
              {panels[tab]}
            </div>
          </div>
        </aside>

        <div className={cn("min-h-0", size === "narrow" && "pb-[calc(4.5rem+env(safe-area-inset-bottom))]")}>
          <Canvas context={context} published={published} previewAs={previewAs} onKey={onKey} />
        </div>

        {size === "wide" && !wideData && (
          <aside inert={building || undefined} aria-label="Settings" className={cn("min-h-0 overflow-y-auto border-l bg-surface p-4", building && "opacity-60")}>
            {panels.edit}
          </aside>
        )}
      </div>

      {/* Phones and tablets: panels as bottom sheets */}
      <nav aria-label="Editor tools" className={cn("fixed inset-x-0 bottom-0 z-30 flex items-center justify-around gap-2 border-t bg-surface px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]", size !== "narrow" && "hidden")}>
        {(
          [
            ["sections", "Sections", LayoutList],
            ["theme", "Theme", Palette],
            ["edit", "Edit", Settings2],
            ["more", "More", MoreHorizontal],
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
        <DevicePreviewSwitch value={device} onChange={setDevice} className="md:hidden" />
      </nav>
      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-dialog p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="font-display text-lg">{sheet === "more" ? "More" : RAIL.find((r) => r.id === sheet)?.title}</SheetTitle>
          <SheetDescription className="sr-only">{sheet === "more" ? "Pages, About and FAQ, reviews and questions" : "Editor panel"}</SheetDescription>
          <div className="mt-3">
            {sheet === "more" ? (
              <ul className="flex flex-col gap-1">
                {RAIL.filter((r) => r.data).map(({ id, title, icon: Icon }) => (
                  <li key={id}>
                    <button type="button" onClick={() => setSheet(id)} className="flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-sm font-medium hover:bg-muted">
                      <Icon className="size-5 text-muted-foreground" aria-hidden /> {title}
                      {id === "reviews" && !!counts.reviews && <span className="ml-auto rounded-full bg-muted px-2 font-mono text-xs">{counts.reviews}</span>}
                      {id === "questions" && !!counts.questions && <span className="ml-auto rounded-full bg-muted px-2 font-mono text-xs">{counts.questions}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              sheet && panels[sheet]
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AddPicker context={context} />
      <CanvasIconPicker />
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
