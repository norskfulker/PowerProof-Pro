"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { RenderContext } from "@/lib/api";
import { AI_LANGUAGES, AI_PAGE_TYPES, aiBriefSchema, type AiBrief, type AiPageType } from "@/lib/pages/ai";
import { allowanceText, useAiBuild } from "./ai-build-store";
import { preferredLanguage } from "./ai-chat";
import { useEditor, useEditorStore } from "./editor-context";

const BY_CODE: Record<string, string> = { en: "English", hi: "Hindi", bn: "Bengali", mr: "Marathi", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", gu: "Gujarati", pa: "Punjabi", ur: "Urdu", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", ar: "Arabic", id: "Indonesian", ja: "Japanese" };

/** The creator's language: what they chose last time, else their browser's */
function browserLanguage(): string {
  return (typeof navigator !== "undefined" && BY_CODE[navigator.language.slice(0, 2)]) || "English";
}

const PLACEHOLDER: Record<AiPageType, string> = {
  home: "What you sell, who it's for, and what makes your store different.",
  launch: "The product you're launching, who it helps, and what's inside.",
  sale: "What's on sale, how much off, and until when.",
  bio: "Where you want your followers to go: your best products, a freebie, your newsletter…",
  lead: "What you're giving away for free, and who it's for.",
  squeeze: "The one promise, and what people get when they sign up.",
  booking: "What the call is for, how long, and who should book.",
  clickthrough: "The offer you're warming people up for, and the three best reasons to want it.",
  blank: "Describe the page you want and what it should do.",
};

const TONES = ["friendly", "professional", "bold", "playful", "calm", "luxury"] as const;

/** The page type a page was made from, as the AI knows it */
export function aiTypeOf(template: string): AiPageType {
  return (AI_PAGE_TYPES.some((t) => t.id === template) ? template : "blank") as AiPageType;
}

/**
 * "Build with AI": the brief, then the build shown live on the canvas, then Keep, Try again or
 * Discard. Kept pages are saved as a version; publishing stays the creator's click.
 * For adding a single section by typing, the add-section picker's AI tab chats instead.
 */
export function AiBuilder({ open, onOpenChange, pageId, template, isHome, context, flush }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pageId: string;
  template: string;
  isHome: boolean;
  context: RenderContext;
  /** Saves the draft now */
  flush: () => Promise<void>;
}) {
  const editor = useEditorStore();
  const hasBlocks = useEditor((s) => s.doc.blocks.length > 0);
  const phase = useAiBuild((s) => s.phase);
  const allowance = useAiBuild((s) => s.allowance);
  const allowanceError = useAiBuild((s) => s.allowanceError);
  const [brief, setBrief] = useState<AiBrief>(() => ({ pageType: isHome ? "home" : aiTypeOf(template), description: "", audience: "", tone: "friendly", language: "English", productIds: [], theme: true, mode: "replace" }));
  const [error, setError] = useState<string>();

  // The day's allowance and the creator's language, each time the brief opens
  useEffect(() => {
    if (!open) return;
    let live = true;
    queueMicrotask(() => live && setBrief((b) => ({ ...b, language: b.language === "English" ? preferredLanguage(browserLanguage()) : b.language })));
    void useAiBuild.getState().refreshAllowance(context.store.id);
    return () => {
      live = false;
    };
  }, [open, context.store.id]);

  const left = allowance ? Math.max(0, allowance.daily - allowance.used) : undefined;
  const set = (p: Partial<AiBrief>) => setBrief((b) => ({ ...b, ...p }));

  async function start() {
    const parsed = aiBriefSchema.safeParse(brief);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(undefined);
    try {
      localStorage.setItem("pp:ai-language", brief.language);
    } catch {
      /* storage blocked */
    }
    onOpenChange(false);
    useAiBuild.getState().pushUser(`Build the ${parsed.data.pageType} page: ${parsed.data.description.slice(0, 140)}${parsed.data.description.length > 140 ? "…" : ""}`);
    const res = await useAiBuild.getState().start(editor, parsed.data, { pageId, isHome, slug: context.store.slug, fromChat: false });
    if (res.placed === 0) {
      setError(res.error ?? "AI didn't add any sections. Try a more detailed description.");
      onOpenChange(true);
    }
  }

  async function keep() {
    await useAiBuild.getState().keep(flush);
  }

  function discard(again: boolean) {
    useAiBuild.getState().discard(() => {
      if (again) onOpenChange(true);
    });
  }

  const type = AI_PAGE_TYPES.find((t) => t.id === brief.pageType) ?? AI_PAGE_TYPES[0];
  const blocked = !allowance?.connected || left === 0 || (allowance.freeLeft !== null && allowance.freeLeft <= 0);

  return (
    <>
      {phase.kind !== "idle" && (
        <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-primary-soft px-4 py-2.5 text-sm">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          {phase.kind === "running" ? (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> {phase.status}…
                <span className="text-muted-foreground">{phase.sections ? `${phase.sections} section${phase.sections === 1 ? "" : "s"} so far` : "Sections appear on the page as they're written"}</span>
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={() => useAiBuild.getState().stop()}>
                <Square aria-hidden /> Stop
              </Button>
            </>
          ) : (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">
                  {phase.error ? `AI stopped after ${phase.sections} section${phase.sections === 1 ? "" : "s"}.` : `AI built ${phase.sections} section${phase.sections === 1 ? "" : "s"}.`} Look it over, then keep it or try again.
                </span>
                {(phase.error || phase.summary || phase.notes.length > 0) && <span className="text-muted-foreground">{[phase.error, phase.summary, ...phase.notes].filter(Boolean).join(" ")}</span>}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => discard(false)}>
                  <X aria-hidden /> Discard
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => discard(true)}>
                  <RotateCcw aria-hidden /> Try again
                </Button>
                <Button type="button" size="sm" onClick={keep}>
                  <Check aria-hidden /> Keep this page
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" aria-hidden /> Build this page with AI
            </DialogTitle>
            <DialogDescription>Describe it in a few lines. AI looks at your product pictures and media library, then designs every section from your store&apos;s real products and details. You keep it or not, and buyers see nothing until you publish. Adding one section? Type it into the AI chat tab beside Sections instead.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-type">Page type</Label>
              <Select value={brief.pageType} onValueChange={(v) => set({ pageType: v as AiPageType })} disabled={isHome}>
                <SelectTrigger id="ai-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_PAGE_TYPES.filter((t) => (isHome ? t.id === "home" : t.id !== "home")).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{type.guide.split(".")[0]}.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-desc">What should the page do?</Label>
              <Textarea id="ai-desc" rows={4} maxLength={2000} value={brief.description} placeholder={PLACEHOLDER[brief.pageType]} onChange={(e) => set({ description: e.target.value })} aria-invalid={!!error || undefined} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-aud">Who it&apos;s for (optional)</Label>
                <Input id="ai-aud" maxLength={300} value={brief.audience} placeholder="e.g. new UI designers" onChange={(e) => set({ audience: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-lang">Language</Label>
                <Select value={brief.language} onValueChange={(language) => set({ language })}>
                  <SelectTrigger id="ai-lang" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{AI_LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-medium">Tone</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tone">
                {TONES.map((t) => (
                  <Button key={t} type="button" size="sm" variant={brief.tone === t ? "primary" : "secondary"} role="radio" aria-checked={brief.tone === t} onClick={() => set({ tone: t })} className="capitalize">
                    {t}
                  </Button>
                ))}
              </div>
            </fieldset>

            {context.products.length > 0 && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-sm font-medium">Products to feature</legend>
                <p className="-mt-1 text-xs text-muted-foreground">None ticked: AI picks from all {context.products.length}.</p>
                <div className="max-h-40 overflow-y-auto rounded-control border">
                  {context.products.map((p) => (
                    <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b px-3 text-sm last:border-b-0">
                      <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={brief.productIds.includes(p.id)} onChange={(e) => set({ productIds: e.target.checked ? [...brief.productIds, p.id] : brief.productIds.filter((x) => x !== p.id) })} />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{p.title}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4 text-sm">
              <span className="flex flex-col">
                <span className="font-medium">Design the theme too</span>
                <span className="text-xs text-muted-foreground">Colours, fonts, colour schemes and the announcement bar, for the whole store. Saved as a draft like everything else.</span>
              </span>
              <Switch checked={brief.theme} onCheckedChange={(theme) => set({ theme })} aria-label="Design the theme too" />
            </label>

            {hasBlocks && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-sm font-medium">This page already has sections</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What to do with them">
                  {([["replace", "Replace them"], ["append", "Add after them"]] as const).map(([v, l]) => (
                    <Button key={v} type="button" size="sm" variant={brief.mode === v ? "primary" : "secondary"} role="radio" aria-checked={brief.mode === v} onClick={() => set({ mode: v })}>
                      {l}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Either way you can still undo, or discard the result.</p>
              </fieldset>
            )}

            {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          </div>

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {allowanceError ?? (!allowance ? "Checking your AI allowance…" : allowanceText(allowance))}
            </p>
            <Button type="button" onClick={start} disabled={blocked || phase.kind === "running"}>
              <Sparkles aria-hidden /> Build the page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
