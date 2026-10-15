"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { preferredLanguage } from "@/components/page-builder/ai-chat";
import { draftStoreWithAi, type AiStoreDraft } from "@/lib/api";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";
import { AI_LANGUAGES } from "@/lib/pages/ai";
import type { SetupStore } from "@/lib/supabase/creator-gate";
import { AiReview } from "./ai-review";

export interface AiBriefValues {
  description: string;
  link: string;
  rights: boolean;
  country: string;
  language: string;
}

const EXAMPLES = [
  "I sell Notion templates for students: a study planner, an exam tracker and a habit tracker.",
  "Handmade soy candles from Pune, in small batches. Scents inspired by Indian monsoon and spices.",
  "Lightroom presets for travel photographers, plus a short course on editing on your phone.",
];

/**
 * Setting the store up with AI: a few words (and optionally a link to the creator's own shop), then
 * a full draft to review. Nothing is saved until they create the store from the review.
 */
export function AiSetup({ existing }: { /** The store made by hand during this setup, if any */ existing: SetupStore | null }) {
  const [brief, setBrief] = useState<AiBriefValues>(() => ({ description: "", link: "", rights: false, country: DEFAULT_COUNTRY, language: preferredLanguage() }));
  const [draft, setDraft] = useState<{ draft: AiStoreDraft; warnings: string[]; brief: AiBriefValues } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController | null>(null);

  async function run() {
    setError(undefined);
    if (brief.description.trim().length < 10) return setError("Say a little more about what you sell, in a sentence or two.");
    if (brief.link.trim() && !brief.rights) return setError("Tick the box to confirm you may sell the products at that link.");
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPending(true);
    try {
      const r = await draftStoreWithAi({ ...brief, link: brief.link.trim() }, ctrl.signal);
      setDraft({ ...r, brief: { ...brief } });
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "AI couldn't draft your store. Try again.");
    } finally {
      if (abort.current === ctrl) setPending(false);
    }
  }

  if (draft) return <AiReview draft={draft.draft} warnings={draft.warnings} country={draft.brief.country} link={draft.brief.link.trim() || undefined} existing={existing} onRedo={() => setDraft(null)} />;

  return (
    <section aria-labelledby="ai-brief-title" className="rounded-dialog border bg-surface">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <h1 id="ai-brief-title" className="text-[1.75rem]">Tell AI about your business</h1>
            <p className="text-muted-foreground">A sentence or two is enough. You&apos;ll check everything before anything is saved.</p>
          </div>
          <FormError message={error} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-description">What do you sell, and who is it for?</Label>
            <Textarea id="ai-description" autoFocus rows={5} maxLength={2000} value={brief.description} disabled={pending} onChange={(e) => setBrief({ ...brief, description: e.target.value })} placeholder={EXAMPLES[0]} />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" disabled={pending} onClick={() => setBrief({ ...brief, description: x })} className="rounded-full border bg-surface-sunken px-2.5 py-1 text-left text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50">
                  {x.split(":")[0].split(".")[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-link">Already selling somewhere? <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="ai-link" type="url" inputMode="url" maxLength={2000} placeholder="https://yourshop.com or a product page" value={brief.link} disabled={pending} onChange={(e) => setBrief({ ...brief, link: e.target.value })} />
            <p className="text-xs text-muted-foreground">We bring the products from that page across with their titles, descriptions and prices.</p>
            {brief.link.trim() && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={brief.rights} disabled={pending} onCheckedChange={(v) => setBrief({ ...brief, rights: v === true })} className="mt-0.5" />
                <span>These are my products, or I have permission to sell them.</span>
              </label>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {!existing && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="ai-country">Where are you based?</Label>
                <Select value={brief.country} disabled={pending} onValueChange={(country) => setBrief({ ...brief, country })}>
                  <SelectTrigger id="ai-country" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-language">Write my store in</Label>
              <Select value={brief.language} disabled={pending} onValueChange={(language) => setBrief({ ...brief, language })}>
                <SelectTrigger id="ai-language" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{AI_LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div aria-live="polite" className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:px-8">
          {pending && <p className="text-sm text-muted-foreground sm:mr-auto">Drafting your store. This takes up to a minute.</p>}
          <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
            {pending && <Button type="button" variant="ghost" onClick={() => { abort.current?.abort(); setPending(false); }}>Stop</Button>}
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {pending ? "Drafting…" : "Draft my store"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
