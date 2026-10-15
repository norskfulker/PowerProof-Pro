"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/auth-card";
import { usePlan } from "@/components/plan/plan-context";
import { CurrencyInput } from "@/components/pp/currency-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createStoreFromDraft, type AiStoreDraft, type AiStoreProduct } from "@/lib/api";
import { currencyFor } from "@/lib/countries";
import { formatMoney, money } from "@/lib/money";
import { SITE_URL } from "@/lib/format";
import { PALETTES } from "@/lib/palettes";
import { cleanStoreName, STORE_NAME_MAX, storeNameError } from "@/lib/slug";
import type { SetupStore } from "@/lib/supabase/creator-gate";
import { cn } from "@/lib/utils";
import { useStoreLink } from "./use-store-link";

type Row = AiStoreProduct & { include: boolean; key: number };

/**
 * The AI draft, laid out to check and change before anything is saved: the name and link, look,
 * About, FAQ and products. Prices AI only suggested stay empty until the creator accepts or types one.
 */
export function AiReview({
  draft,
  warnings,
  country,
  link,
  existing,
  onRedo,
}: {
  draft: AiStoreDraft;
  warnings: string[];
  country: string;
  link?: string;
  existing: SetupStore | null;
  onRedo: () => void;
}) {
  const router = useRouter();
  const plan = usePlan();
  const currency = currencyFor(country);
  const [name, setName] = useState(existing?.name ?? draft.names[0]);
  const [tagline, setTagline] = useState(draft.tagline);
  const [palette, setPalette] = useState(draft.palette);
  const [sells, setSells] = useState(draft.sells);
  const [about, setAbout] = useState(draft.about);
  const [faq, setFaq] = useState(draft.faq);
  const [rows, setRows] = useState<Row[]>(() => draft.products.map((p, key) => ({ ...p, include: true, key })));
  const [error, setError] = useState<string>();
  const [step, setStep] = useState<string>();
  const link_ = useStoreLink(name, !existing);

  const included = rows.filter((r) => r.include);
  const missingPrice = included.filter((r) => r.price === undefined);
  const suggested = rows.filter((r) => r.include && r.price === undefined && r.suggestedPrice);
  const nameError = storeNameError(cleanStoreName(name));
  const ready = !nameError && (existing ? true : link_.ready) && !step;
  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  async function create() {
    setError(undefined);
    if (nameError) return setError(nameError);
    if (missingPrice.length) return setError(`Add a price for ${missingPrice.length === 1 ? `"${missingPrice[0].title}"` : `${missingPrice.length} products`}, or untick ${missingPrice.length === 1 ? "it" : "them"}.`);
    if (!existing && !link_.current?.slug) return;
    setStep("Creating your store");
    try {
      const r = await createStoreFromDraft(
        {
          name: cleanStoreName(name),
          slug: existing?.slug ?? link_.current!.slug!,
          country,
          tagline,
          palette,
          sells,
          about,
          faq,
          products: included.map((p) => ({ title: p.title, description: p.description, kind: p.kind, collection: p.collection, price: p.price!, sourceUrl: p.sourceUrl })),
          link,
          existingStoreId: existing?.id,
        },
        setStep
      );
      if (r.failed.length) toast.error(`${r.failed.length === 1 ? "One product" : `${r.failed.length} products`} didn't save`, { description: r.failed.join(", ") });
      else toast.success("Your store is ready to design", { description: "AI is building your home page now." });
      // AI Studio builds the home page from what was just saved; the creator opens the store from the editor
      router.replace("/store/current/design/studio?first=1");
    } catch (e) {
      setStep(undefined);
      if (!plan.handleLimitError(e)) setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <section aria-labelledby="ai-review-title" className="rounded-dialog border bg-surface">
      <div className="flex flex-col gap-8 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 id="ai-review-title" className="text-[1.75rem]">Check your store</h1>
          <p className="text-muted-foreground">AI drafted this from what you told it. Change anything, then create your store. Nothing is saved until you do.</p>
        </div>

        {(warnings.length > 0 || draft.notes.length > 0) && (
          <ul className="flex flex-col gap-1.5 rounded-control border bg-surface-sunken p-3 text-sm">
            {[...warnings, ...draft.notes].map((n, i) => (
              <li key={i} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> {n}</li>
            ))}
          </ul>
        )}

        {/* Name and link */}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">Name</legend>
          {!existing && draft.names.length > 1 && (
            <div role="radiogroup" aria-label="Names AI suggested" className="flex flex-wrap gap-2">
              {draft.names.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={name === n} onClick={() => setName(n)} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm pointer-coarse:min-h-11", name === n ? "border-primary bg-primary-soft/50 font-medium" : "hover:border-primary")}>
                  {name === n && <Check className="size-3.5" aria-hidden />} {n}
                </button>
              ))}
            </div>
          )}
          <Label htmlFor="ai-name" className="sr-only">Store name</Label>
          <Input id="ai-name" maxLength={STORE_NAME_MAX + 10} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} />
          {nameError && <p className="text-sm text-danger">{nameError}</p>}
          <div aria-live="polite" className="rounded-control border bg-surface-sunken px-3 py-2">
            <p className="text-xs text-muted-foreground">Your store link</p>
            <p className="flex min-h-6 items-center gap-1.5 font-mono text-[0.8125rem] break-all">
              {existing ? (
                <span>{SITE_URL}/{existing.slug}</span>
              ) : link_.current?.slug ? (
                <>
                  <span className="min-w-0">{SITE_URL}/{link_.current.slug}</span>
                  {link_.current.available === undefined ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-label="Checking" /> : link_.current.available ? <Check className="size-3.5 shrink-0 text-success" aria-label="Available" /> : <X className="size-3.5 shrink-0 text-danger" aria-label="Taken" />}
                </>
              ) : link_.current?.failed ? (
                <span className="text-danger">We couldn&apos;t make a link just now. Change the name slightly or try again.</span>
              ) : link_.waiting ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Making your link" />
              ) : (
                <span className="text-muted-foreground">{SITE_URL}/…</span>
              )}
            </p>
            {existing && <p className="mt-1 text-xs text-muted-foreground">Your link stays the same.</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-tagline">Tagline</Label>
            <Input id="ai-tagline" maxLength={140} value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
        </fieldset>

        {/* Look and kind */}
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-lg font-semibold">Look</legend>
          <div role="radiogroup" aria-label="Colours" className="flex flex-wrap gap-2">
            {PALETTES.map((p) => (
              <button key={p.name} type="button" role="radio" aria-checked={palette === p.name} aria-label={p.name} title={p.name} onClick={() => setPalette(p.name)} className={cn("grid size-10 place-items-center rounded-full border-2 pointer-coarse:size-11", palette === p.name ? "border-foreground" : "border-transparent")}>
                <span className="grid size-8 place-items-center rounded-full border" style={{ background: p.bg }}>
                  <span className="size-3 rounded-full" style={{ background: p.accent }} />
                </span>
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="What you sell" className="inline-flex self-start rounded-full bg-muted p-0.5 text-sm font-medium">
            {(["digital", "physical"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={sells === k} onClick={() => setSells(k)} className={cn("min-h-9 rounded-full px-3.5 pointer-coarse:min-h-11", sells === k ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {k === "digital" ? "Digital downloads" : "Physical products"}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Products */}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-lg font-semibold">Products</legend>
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm text-muted-foreground">They&apos;re saved as drafts. {sells === "digital" ? "Add the file buyers download to each one, then make it live." : "Add photos and stock to each one, then make it live."}</p>
            {suggested.length > 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={() => setRows((rs) => rs.map((r) => (r.include && r.price === undefined && r.suggestedPrice ? { ...r, price: r.suggestedPrice } : r)))}>
                Use suggested prices
              </Button>
            )}
          </div>
          {rows.length === 0 && <p className="rounded-control border border-dashed p-4 text-sm text-muted-foreground">No products in the draft. Add them once your store is created.</p>}
          {rows.map((r) => (
            <div key={r.key} className={cn("flex flex-col gap-3 rounded-control border p-4", !r.include && "opacity-60")}>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={r.include} onCheckedChange={(v) => patch(r.key, { include: v === true })} /> Add this product
              </label>
              <Input aria-label="Title" maxLength={160} value={r.title} disabled={!r.include} onChange={(e) => patch(r.key, { title: e.target.value })} />
              <Textarea aria-label="Description" rows={3} maxLength={2000} value={r.description} disabled={!r.include} onChange={(e) => patch(r.key, { description: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`price-${r.key}`} className="text-xs">Price ({currency})</Label>
                  <CurrencyInput id={`price-${r.key}`} currency={currency} disabled={!r.include} value={r.price === undefined ? undefined : money(r.price, currency)} onChange={(m) => patch(r.key, { price: m?.amount })} invalid={r.include && r.price === undefined && !!error} />
                  {r.price === undefined && r.suggestedPrice ? (
                    <button type="button" disabled={!r.include} onClick={() => patch(r.key, { price: r.suggestedPrice })} className="self-start text-xs text-primary hover:underline">
                      AI suggests {formatMoney(money(r.suggestedPrice, currency))}. Use it
                    </button>
                  ) : r.sourceUrl && r.price !== undefined ? (
                    <p className="text-xs text-muted-foreground">From your shop</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`col-${r.key}`} className="text-xs">Collection <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id={`col-${r.key}`} maxLength={80} list="ai-collections" value={r.collection} disabled={!r.include} onChange={(e) => patch(r.key, { collection: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
          <datalist id="ai-collections">{draft.collections.map((c) => <option key={c} value={c} />)}</datalist>
        </fieldset>

        {/* About */}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">About you</legend>
          <Textarea aria-label="Your story" rows={5} maxLength={1200} value={about.story} onChange={(e) => setAbout({ ...about, story: e.target.value })} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-location">Location <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="ai-location" maxLength={80} value={about.location} onChange={(e) => setAbout({ ...about, location: e.target.value })} />
          </div>
        </fieldset>

        {/* FAQ */}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">Questions buyers ask</legend>
          {faq.map((f, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-control border p-3">
              <div className="flex items-center gap-2">
                <Input aria-label={`Question ${i + 1}`} maxLength={200} value={f.q} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove question ${i + 1}`} onClick={() => setFaq(faq.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
              <Textarea aria-label={`Answer ${i + 1}`} rows={2} maxLength={600} value={f.a} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            </div>
          ))}
          {faq.length < 8 && (
            <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setFaq([...faq, { q: "", a: "" }])}><Plus aria-hidden /> Add a question</Button>
          )}
        </fieldset>

        <FormError message={error} />
      </div>
      <div aria-live="polite" className="sticky bottom-0 flex flex-col-reverse gap-2 rounded-b-dialog border-t bg-surface px-6 py-4 sm:flex-row sm:items-center sm:px-8">
        <Button type="button" variant="ghost" onClick={onRedo} disabled={!!step} className="sm:-ml-3"><RotateCcw aria-hidden /> Start over</Button>
        {step && <p className="text-sm text-muted-foreground sm:ml-auto">{step}…</p>}
        <Button type="button" className={step ? "" : "sm:ml-auto"} onClick={() => void create()} disabled={!ready}>
          {step && <Loader2 className="animate-spin" aria-hidden />}
          {existing ? "Update my store" : "Create my store"}
        </Button>
      </div>
    </section>
  );
}
