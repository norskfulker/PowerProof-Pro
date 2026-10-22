"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Brush, Check, Eye, Loader2, RotateCcw, Square, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { usePlan } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveEditorDraft, type EditorSession } from "@/lib/api";
import { PREVIEW_CHANNEL, type SiteDraft } from "@/lib/pages/editor-store";
import { HOME_TEMPLATE } from "@/lib/pages/templates";
import { cn } from "@/lib/utils";
import { BuildWaySwitch } from "@/components/store-admin/build-way-switch";
import { aiTypeOf } from "./ai-builder";
import { allowanceText, useAiBuild } from "./ai-build-store";
import { preferredLanguage } from "./ai-chat";
import { Canvas } from "./canvas";
import { DevicePreviewSwitch } from "./device-preview-switch";
import { EditorProvider, useEditor, useEditorStore } from "./editor-context";
import { Textarea } from "@/components/ui/textarea";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const STARTERS = [
  "A clean, minimal store for my digital planners, with a big hero and my bestsellers",
  "Make it feel premium: dark, gold accents, elegant serif headings",
  "A launch page for my new course with a countdown, what's inside, reviews and FAQ",
  "Playful and colourful, for a young audience, with lots of product pictures",
];

type Mode = "build" | "add";

/** Saves the draft a moment after each change, like the editor does */
function useAutosave(pageId: string, initialSite: SiteDraft | undefined) {
  const store = useEditorStore();
  const rev = useEditor((s) => s.rev);
  const savedRev = useEditor((s) => s.savedRev);
  const savedSite = useRef(initialSite);
  const saving = useRef<Promise<void> | null>(null);
  const flush = useCallback(async () => {
    if (saving.current) await saving.current;
    const s = store.getState();
    if (s.rev === s.savedRev || s.aiBase) return;
    const at = s.rev;
    const site = s.site && !same(s.site, savedSite.current) ? s.site : undefined;
    const p = saveEditorDraft(pageId, s.doc, site)
      .then(() => {
        s.markSaved(at);
        if (site) savedSite.current = site;
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel(PREVIEW_CHANNEL);
          ch.postMessage(pageId);
          ch.close();
        }
      })
      .catch(() => {
        toast.error("Your changes weren't saved. Check your connection.");
      });
    saving.current = p;
    await p;
  }, [store, pageId]);
  useEffect(() => {
    if (rev === savedRev) return;
    const t = setTimeout(flush, 500);
    return () => clearTimeout(t);
  }, [rev, savedRev, flush]);
  return flush;
}

/** What AI Studio asks for on its own right after the store was set up with AI */
const FIRST_BUILD = "Build my store's home page from my store: its name, tagline, products, About story and FAQ. Make it clear what I sell and who it's for.";

function Studio({ session, autostart }: { session: EditorSession; autostart?: boolean }) {
  const { page, pages, context } = session;
  const router = useRouter();
  const store = useEditorStore();
  const device = useEditor((s) => s.device);
  const setDevice = useEditor((s) => s.setDevice);
  const canUndo = useEditor((s) => s.past.length > 0);
  const empty = useEditor((s) => s.doc.blocks.length === 0);
  const messages = useAiBuild((s) => s.messages);
  const phase = useAiBuild((s) => s.phase);
  const allowance = useAiBuild((s) => s.allowance);
  const allowanceError = useAiBuild((s) => s.allowanceError);
  const { upgrade } = usePlan();
  const flush = useAutosave(page.id, session.site);
  const isHome = page.template === HOME_TEMPLATE;
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>(empty ? "build" : "add");
  const [restyle, setRestyle] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void useAiBuild.getState().refreshAllowance(context.store.id);
  }, [context.store.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, phase]);

  const running = phase.kind === "running";
  const reviewing = phase.kind === "review";
  const left = allowance ? Math.max(0, allowance.daily - allowance.used) : undefined;
  const out = !!allowance && (left === 0 || (allowance.freeLeft !== null && allowance.freeLeft <= 0));
  const blocked = !allowance?.connected || out;

  async function send(want = text.trim(), as: Mode = mode) {
    if (want.length < 3 || running || blocked) return;
    if (reviewing) await useAiBuild.getState().keep(flush);
    setText("");
    useAiBuild.getState().pushUser(want);
    const build = as === "build";
    await useAiBuild.getState().start(
      store,
      {
        pageType: aiTypeOf(page.template),
        description: build ? want : `Add to the page from this (don't rebuild or repeat what's there): ${want}`,
        audience: "",
        tone: "friendly",
        language: preferredLanguage(),
        productIds: [],
        theme: build && restyle,
        mode: build ? "replace" : "append",
        studio: true,
      },
      { pageId: page.id, isHome, slug: context.store.slug, fromChat: !build }
    );
    setMode("add");
  }

  // Just set up with AI: build the home page once, as soon as the allowance says it may
  const started = useRef(false);
  useEffect(() => {
    if (!autostart || started.current || !allowance || blocked || messages.length > 0 || phase.kind !== "idle" || !isHome) return;
    started.current = true;
    router.replace("/store/current/design/studio");
    void send(FIRST_BUILD, "build");
  });

  const previewHref = `/preview/${page.id}`;

  return (
    <div className="-mx-3 flex min-h-[calc(100dvh-4rem)] flex-col border-t bg-background md:-mx-0 md:min-h-dvh md:border-t-0">
      {/* Bar */}
      <header className="sticky top-16 z-20 flex flex-wrap items-center gap-2 border-b bg-surface/90 px-3 py-2 backdrop-blur-md md:top-0 md:px-4">
        <BuildWaySwitch current="ai" beforeLeave={flush} compact />
        <Select value={page.id} onValueChange={async (id) => { await flush(); router.push(`/store/current/design/studio?page=${id}`); }}>
          <SelectTrigger className="w-auto max-w-56 border-transparent bg-transparent font-semibold hover:border-input" aria-label="Page"><SelectValue /></SelectTrigger>
          <SelectContent>
            {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.home ? "Home page" : p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="mx-auto"><DevicePreviewSwitch value={device} onChange={setDevice} /></div>
        <Button type="button" variant="ghost" size="icon" onClick={() => store.getState().undo()} disabled={!canUndo || running} aria-label="Undo" title="Undo"><Undo2 /></Button>
        <Button type="button" variant="secondary" onClick={() => { window.open(previewHref, `pp-preview-${page.id}`); void flush(); }}><Eye aria-hidden /> <span className="max-sm:sr-only">Preview</span></Button>
        <Button asChild>
          <Link href={`/store/current/design/pages/${page.id}/edit`} onClick={() => void flush()}><Brush aria-hidden /> Open in editor</Link>
        </Button>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[24rem_minmax(0,1fr)]">
        {/* Chat */}
        <aside aria-label="AI chat" className="flex flex-col border-b bg-surface lg:sticky lg:top-[3.25rem] lg:h-[calc(100dvh-3.25rem)] lg:border-r lg:border-b-0">
          <div aria-live="polite" className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <p className="font-display text-2xl leading-tight">What should your store look like?</p>
                  <p className="text-sm text-muted-foreground">Describe it in your own words. AI builds it from your real products and pictures, live on the right. Then keep chatting to change it.</p>
                </div>
                <div className="flex flex-col gap-2">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" disabled={blocked} onClick={() => { setText(s); input.current?.focus(); }} className="rounded-control border bg-surface-sunken px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary-soft/40 disabled:opacity-50">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("max-w-[88%] rounded-[14px] px-3.5 py-2.5 text-sm whitespace-pre-line", m.role === "user" ? "self-end rounded-br-[4px] bg-primary text-primary-foreground" : "self-start rounded-bl-[4px] border bg-surface-sunken")}>
                {m.text}
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-2 self-start rounded-[14px] border bg-surface-sunken px-3.5 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> {phase.status}…
              </div>
            )}
            {reviewing && (
              <div className="flex flex-wrap items-center gap-2 self-stretch rounded-control border border-primary/30 bg-primary-soft/50 p-2.5">
                <span className="flex-1 text-xs font-medium">Keep this version?</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => useAiBuild.getState().discard(() => undefined)}><X aria-hidden /> Discard</Button>
                <Button type="button" size="sm" onClick={() => void useAiBuild.getState().keep(flush)}><Check aria-hidden /> Keep</Button>
              </div>
            )}
            <div ref={bottom} />
          </div>

          <div className="flex flex-col gap-2 border-t p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="What AI does with your message" className="inline-flex rounded-full bg-muted p-0.5 text-xs font-medium">
                {(["build", "add"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("rounded-full px-3 py-1", mode === m ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {m === "build" ? "Rebuild the page" : "Add to it"}
                  </button>
                ))}
              </div>
              {mode === "build" && (
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Restyle colours and fonts <Switch size="sm" checked={restyle} onCheckedChange={setRestyle} /></label>
              )}
            </div>
            <div className="relative">
              <label htmlFor="studio-input" className="sr-only">Describe what you want</label>
              <Textarea
                ref={input}
                id="studio-input"
                size="sm"
                rows={3}
                maxLength={2000}
                value={text}
                disabled={running}
                placeholder={mode === "build" ? "Describe the store you want…" : "What should AI add? e.g. a reviews wall"}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                className="resize-none pr-12"
              />
              {running ? (
                <Button type="button" size="icon-sm" variant="secondary" className="absolute right-2 bottom-3 rounded-full" onClick={() => useAiBuild.getState().stop()} aria-label="Stop"><Square /></Button>
              ) : (
                <Button type="button" size="icon-sm" className="absolute right-2 bottom-3 rounded-full" onClick={() => void send()} disabled={text.trim().length < 3 || blocked} aria-label="Send"><ArrowUp /></Button>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{allowanceError ?? (allowance ? allowanceText(allowance) : "Checking your AI allowance…")}</p>
              {out && <Button type="button" size="sm" variant="ghost" className="text-primary" onClick={() => upgrade()}>Upgrade</Button>}
              {messages.length > 0 && !running && !out && (
                <Button type="button" size="sm" variant="ghost" onClick={() => useAiBuild.getState().clearChat()}><RotateCcw aria-hidden /> New chat</Button>
              )}
            </div>
          </div>
        </aside>

        {/* Live preview */}
        <div className="min-w-0">
          <Canvas context={context} onAddress={() => { window.open(previewHref, `pp-preview-${page.id}`); void flush(); }} address={`https://powerproof.app/s/${context.store.slug}${page.slug && !isHome ? `/p/${page.slug}` : ""}`} className="min-h-full" />
        </div>
      </div>
    </div>
  );
}

/** AI Studio: chat on one side, the store being built on the other. Saves as a draft, like the editor. */
export function AiStudio({ session, autostart }: { session: EditorSession; /** Build the home page straight away (after AI setup) */ autostart?: boolean }) {
  return (
    <EditorProvider initial={session.page.draft} site={session.site}>
      <Studio session={session} autostart={autostart} />
    </EditorProvider>
  );
}
