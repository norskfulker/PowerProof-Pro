"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { fromMajor, money } from "@/lib/money";
import { dealRuleSchema, type DealRuleInput } from "@/lib/pricing/deal-rule-schema";
import type { DealRule, DealRuleSpec, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoneyText } from "./money-text";
import { ProductImageView } from "./product-cover";
import { StepProgress } from "./step-progress";

/* ------------------------------------------------------------------ */
/* Draft model: what the creator picks, mapped to a rule spec           */
/* ------------------------------------------------------------------ */

export type WhenKind = "together" | "any" | "spend" | "count";
export type ThenKind = "percent" | "gift" | "choose_gift" | "tiers" | "cheapest_free";

export interface WizardDraft {
  id?: string;
  when: WhenKind;
  then: ThenKind;
  productIds: string[];
  minSpend: string;
  percent: string;
  giftId: string;
  giftIds: string[];
  tiers: { minItems: string; percent: string }[];
  buy: string;
  name: string;
  active: boolean;
  stackable: boolean;
  startsAt: string;
  endsAt: string;
}

const WHEN: { id: WhenKind; label: string; hint: string }[] = [
  { id: "together", label: "These products together", hint: "Reward buying a set" },
  { id: "any", label: "Any of these products", hint: "Reward a specific purchase" },
  { id: "spend", label: "Order total reaches", hint: "Reward bigger orders" },
  { id: "count", label: "Number of items", hint: "Reward buying more" },
];

const THEN: Record<WhenKind, { id: ThenKind; label: string; hint: string }[]> = {
  together: [{ id: "percent", label: "Percent off each of them", hint: "e.g. 25% off the set" }],
  any: [
    { id: "percent", label: "Percent off, for a limited time", hint: "Needs an end date" },
    { id: "gift", label: "A free gift", hint: "You pick the gift" },
    { id: "choose_gift", label: "They choose a free gift", hint: "From 2 to 4 options" },
  ],
  spend: [
    { id: "percent", label: "Percent off everything", hint: "e.g. 15% off" },
    { id: "gift", label: "A free gift", hint: "You pick the gift" },
    { id: "choose_gift", label: "They choose a free gift", hint: "From 2 to 4 options" },
  ],
  count: [
    { id: "tiers", label: "Bigger discount for more items", hint: "e.g. 2 items 10%, 3 items 20%" },
    { id: "cheapest_free", label: "The cheapest one is free", hint: "e.g. buy 3, cheapest free" },
  ],
};

const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);
const rupees = (v: string) => fromMajor(Number(v) || 0);
const int = (v: string) => (v.trim() === "" ? NaN : Math.round(Number(v)));

export function emptyDraft(): WizardDraft {
  return { when: "together", then: "percent", productIds: [], minSpend: "", percent: "20", giftId: "", giftIds: [], tiers: [{ minItems: "2", percent: "10" }, { minItems: "3", percent: "20" }], buy: "3", name: "", active: true, stackable: false, startsAt: "", endsAt: "" };
}

export function draftFromRule(r: DealRule): WizardDraft {
  const d: WizardDraft = { ...emptyDraft(), id: r.id, name: r.name, active: r.active, stackable: r.stackable, startsAt: toLocal(r.startsAt), endsAt: toLocal(r.endsAt) };
  switch (r.kind) {
    case "bundle_discount":
      return { ...d, when: "together", then: "percent", productIds: r.productIds, percent: String(r.percent) };
    case "limited_time":
      return { ...d, when: "any", then: "percent", productIds: r.productIds, percent: String(r.percent) };
    case "free_gift":
      return { ...d, when: r.triggerIds.length ? "any" : "spend", then: "gift", productIds: r.triggerIds, minSpend: r.minSpend ? String(r.minSpend.amount / 100) : "", giftId: r.giftId };
    case "choose_gift":
      return { ...d, when: r.triggerIds.length ? "any" : "spend", then: "choose_gift", productIds: r.triggerIds, minSpend: r.minSpend ? String(r.minSpend.amount / 100) : "", giftIds: r.giftIds };
    case "spend_threshold":
      return { ...d, when: "spend", then: "percent", minSpend: String(r.minSpend.amount / 100), percent: String(r.percent) };
    case "tiers":
      return { ...d, when: "count", then: "tiers", productIds: r.productIds, tiers: r.tiers.map((t) => ({ minItems: String(t.minItems), percent: String(t.percent) })) };
    case "buy_x_get_cheapest":
      return { ...d, when: "count", then: "cheapest_free", productIds: r.productIds, buy: String(r.buy) };
  }
}

export function specFromDraft(d: WizardDraft): DealRuleSpec {
  const minSpend = d.minSpend.trim() ? rupees(d.minSpend) : undefined;
  if (d.when === "together") return { kind: "bundle_discount", productIds: d.productIds, percent: int(d.percent) };
  if (d.when === "count") {
    return d.then === "cheapest_free"
      ? { kind: "buy_x_get_cheapest", productIds: d.productIds, buy: int(d.buy) }
      : { kind: "tiers", productIds: d.productIds, tiers: d.tiers.map((t) => ({ minItems: int(t.minItems), percent: int(t.percent) })) };
  }
  const triggerIds = d.when === "any" ? d.productIds : [];
  const spend = d.when === "spend" ? minSpend ?? money(0) : undefined;
  if (d.then === "gift") return { kind: "free_gift", triggerIds, minSpend: spend, giftId: d.giftId };
  if (d.then === "choose_gift") return { kind: "choose_gift", triggerIds, minSpend: spend, giftIds: d.giftIds };
  if (d.when === "spend") return { kind: "spend_threshold", minSpend: spend ?? money(0), percent: int(d.percent) };
  return { kind: "limited_time", productIds: d.productIds, percent: int(d.percent) };
}

export function inputFromDraft(d: WizardDraft): DealRuleInput {
  return { ...specFromDraft(d), id: d.id, name: d.name, active: d.active, stackable: d.stackable, startsAt: fromLocal(d.startsAt), endsAt: fromLocal(d.endsAt) } as DealRuleInput;
}

/** The draft as a full rule, for the live preview. Invalid drafts still preview what they can. */
export function previewRule(d: WizardDraft, now: number): DealRule {
  return { ...inputFromDraft(d), id: d.id ?? "draft", name: d.name || "This deal path", createdAt: new Date(now).toISOString(), stats: { views: 0, uses: 0, revenueLift: money(0) } } as DealRule;
}

type Errors = Partial<Record<"when" | "products" | "minSpend" | "then" | "percent" | "gift" | "tiers" | "buy" | "name" | "dates", string>>;

/** Checks one step. Messages are for the creator, in plain words. */
export function validateStep(step: number, d: WizardDraft): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (d.when === "together" && d.productIds.length < 2) e.products = "Pick at least two products to sell together.";
    if (d.when === "any" && d.productIds.length < 1) e.products = "Pick at least one product.";
    if (d.when === "spend" && !(Number(d.minSpend) >= 1)) e.minSpend = "Enter an amount of at least ₹1.";
  }
  if (step === 1) {
    if (d.then === "percent") {
      const p = int(d.percent);
      if (!(p >= 1 && p <= 90)) e.percent = "Use a whole number from 1 to 90.";
    }
    if (d.then === "gift") {
      if (!d.giftId) e.gift = "Pick the free gift.";
      else if (d.when === "any" && d.productIds.includes(d.giftId)) e.gift = "The gift can't also be the product that unlocks it.";
    }
    if (d.then === "choose_gift" && (d.giftIds.length < 2 || d.giftIds.length > 4)) e.gift = "Pick two to four gifts to choose from.";
    if (d.then === "cheapest_free" && !(int(d.buy) >= 2 && int(d.buy) <= 10)) e.buy = "Use a number from 2 to 10.";
    if (d.then === "tiers") {
      const parsed = dealRuleSchema.safeParse({ ...inputFromDraft(d), name: "ok" });
      const issue = parsed.success ? undefined : parsed.error.issues.find((i) => i.path.includes("tiers"));
      if (issue) e.tiers = issue.message;
    }
  }
  if (step === 2) {
    const parsed = dealRuleSchema.safeParse(inputFromDraft(d));
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const key = i.path[0] === "name" ? "name" : i.path[0] === "endsAt" || i.path[0] === "startsAt" ? "dates" : undefined;
        if (key && !e[key]) e[key] = i.message;
      }
    }
  }
  return e;
}

/* ------------------------------------------------------------------ */
/* UI                                                                   */
/* ------------------------------------------------------------------ */

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-medium text-danger">
      {message}
    </p>
  );
}

/** Searchable product list; multi-select with checkboxes or single-select with radios. */
export function ProductPicker({
  products,
  value,
  onChange,
  label,
  multiple = true,
  max,
  errorId,
  idPrefix,
}: {
  products: Product[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
  multiple?: boolean;
  max?: number;
  errorId?: string;
  idPrefix: string;
}) {
  const [q, setQ] = useState("");
  const shown = products.filter((p) => p.title.toLowerCase().includes(q.trim().toLowerCase()));
  const row = (p: Product, control: React.ReactNode) => (
    <label key={p.id} htmlFor={`${idPrefix}-${p.id}`} className="flex min-h-12 cursor-pointer items-center gap-3 border-b px-3 py-1.5 text-sm last:border-b-0 has-[:checked]:bg-primary-soft has-[[data-state=checked]]:bg-primary-soft">
      {control}
      <ProductImageView image={p.images[0]} size="xs" className="w-10 shrink-0" />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{p.title}</span>
      <MoneyText value={p.price} mono className="shrink-0 text-xs text-muted-foreground" />
    </label>
  );
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={errorId}>
      <legend className="mb-1 text-sm font-medium">
        {label}
        {multiple && <span className="ml-2 font-normal text-muted-foreground">{value.length} picked</span>}
      </legend>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label={`Search ${label.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-9" />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-control border bg-surface">
        {shown.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No products match.</p>}
        {multiple ? (
          shown.map((p) =>
            row(
              p,
              <Checkbox
                id={`${idPrefix}-${p.id}`}
                checked={value.includes(p.id)}
                disabled={!!max && value.length >= max && !value.includes(p.id)}
                onCheckedChange={(v) => onChange(v ? [...value, p.id] : value.filter((x) => x !== p.id))}
              />
            )
          )
        ) : (
          <RadioGroup value={value[0] ?? ""} onValueChange={(v) => onChange([v])} aria-label={label} className="gap-0">
            {shown.map((p) => row(p, <RadioGroupItem id={`${idPrefix}-${p.id}`} value={p.id} />))}
          </RadioGroup>
        )}
      </div>
    </fieldset>
  );
}

function ChoiceCards<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { id: T; label: string; hint: string }[]; onChange: (v: T) => void }) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} aria-label={name} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.id} htmlFor={`${name}-${o.id}`} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-control border bg-surface p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
          <RadioGroupItem id={`${name}-${o.id}`} value={o.id} className="mt-0.5" />
          <span className="flex flex-col">
            <span className="text-sm font-semibold">{o.label}</span>
            <span className="text-xs text-muted-foreground">{o.hint}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

const STEPS = ["When", "Then", "Options"];

/**
 * Three steps: When (what must be in the order), Then (the reward), Options (name, stacking,
 * dates). Each step checks itself before moving on; Save checks everything with the shared schema.
 */
export function DealRuleWizard({
  draft,
  onChange,
  products,
  onSave,
  onCancel,
  saving,
}: {
  draft: WizardDraft;
  onChange: (d: WizardDraft) => void;
  products: Product[];
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const live = useMemo(() => products.filter((p) => p.status === "published"), [products]);
  const set = (patch: Partial<WizardDraft>) => {
    onChange({ ...draft, ...patch });
    setErrors({});
  };

  const next = () => {
    const e = validateStep(step, draft);
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-wizard] [aria-invalid=true], [data-wizard] .text-danger")?.scrollIntoView({ block: "center" }));
      return;
    }
    if (step < 2) setStep(step + 1);
    else onSave();
  };

  return (
    <div data-wizard className="flex flex-col gap-6 rounded-card border bg-surface p-4 md:p-6">
      <StepProgress steps={STEPS} current={step} />

      {step === 0 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="font-sans text-base font-semibold tracking-normal">When the buyer&apos;s order has…</h2>
            <ChoiceCards
              name="when"
              value={draft.when}
              options={WHEN}
              onChange={(when) => set({ when, then: THEN[when][0].id, productIds: when === draft.when ? draft.productIds : [] })}
            />
          </div>
          {(draft.when === "together" || draft.when === "any" || draft.when === "count") && (
            <div className="flex flex-col gap-1.5">
              <ProductPicker
                idPrefix="w-prod"
                label={draft.when === "count" ? "Which products count (none picked = all of them)" : draft.when === "together" ? "Products bought together" : "Products that unlock it"}
                products={live}
                value={draft.productIds}
                onChange={(productIds) => set({ productIds })}
                errorId={errors.products ? "w-prod-err" : undefined}
              />
              <FieldError id="w-prod-err" message={errors.products} />
            </div>
          )}
          {draft.when === "spend" && (
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="w-spend">Order total of at least (₹)</Label>
              <Input id="w-spend" inputMode="decimal" value={draft.minSpend} onChange={(e) => set({ minSpend: e.target.value.replace(/[^\d.]/g, "") })} aria-invalid={!!errors.minSpend || undefined} aria-describedby={errors.minSpend ? "w-spend-err" : undefined} />
              <p className="text-xs text-muted-foreground">Counted before any discount.</p>
              <FieldError id="w-spend-err" message={errors.minSpend} />
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="font-sans text-base font-semibold tracking-normal">Then they get…</h2>
            <ChoiceCards name="then" value={draft.then} options={THEN[draft.when]} onChange={(then) => set({ then })} />
          </div>
          {draft.then === "percent" && (
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="w-pct">Percent off</Label>
              <Input id="w-pct" inputMode="numeric" value={draft.percent} onChange={(e) => set({ percent: e.target.value.replace(/\D/g, "") })} aria-invalid={!!errors.percent || undefined} aria-describedby={errors.percent ? "w-pct-err" : "w-pct-hint"} />
              <p id="w-pct-hint" className="text-xs text-muted-foreground">Never goes below a product&apos;s price floor.</p>
              <FieldError id="w-pct-err" message={errors.percent} />
            </div>
          )}
          {draft.then === "gift" && (
            <div className="flex flex-col gap-1.5">
              <ProductPicker idPrefix="w-gift" label="The free gift" multiple={false} products={live} value={draft.giftId ? [draft.giftId] : []} onChange={([giftId]) => set({ giftId })} errorId={errors.gift ? "w-gift-err" : undefined} />
              <FieldError id="w-gift-err" message={errors.gift} />
            </div>
          )}
          {draft.then === "choose_gift" && (
            <div className="flex flex-col gap-1.5">
              <ProductPicker idPrefix="w-gifts" label="Gifts they choose from (2 to 4)" products={live} max={4} value={draft.giftIds} onChange={(giftIds) => set({ giftIds })} errorId={errors.gift ? "w-gifts-err" : undefined} />
              <FieldError id="w-gifts-err" message={errors.gift} />
            </div>
          )}
          {draft.then === "cheapest_free" && (
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="w-buy">Items to buy</Label>
              <Input id="w-buy" inputMode="numeric" value={draft.buy} onChange={(e) => set({ buy: e.target.value.replace(/\D/g, "") })} aria-invalid={!!errors.buy || undefined} aria-describedby={errors.buy ? "w-buy-err" : "w-buy-hint"} />
              <p id="w-buy-hint" className="text-xs text-muted-foreground">Buy {int(draft.buy) || "N"}, the cheapest one is free.</p>
              <FieldError id="w-buy-err" message={errors.buy} />
            </div>
          )}
          {draft.then === "tiers" && (
            <fieldset className="flex flex-col gap-2" aria-describedby={errors.tiers ? "w-tiers-err" : undefined}>
              <legend className="mb-1 text-sm font-medium">Tiers</legend>
              {draft.tiers.map((t, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <div className="flex w-28 flex-col gap-1">
                    <Label htmlFor={`w-tier-n-${i}`} className="text-xs">Items</Label>
                    <Input id={`w-tier-n-${i}`} inputMode="numeric" value={t.minItems} onChange={(e) => set({ tiers: draft.tiers.map((x, j) => (j === i ? { ...x, minItems: e.target.value.replace(/\D/g, "") } : x)) })} />
                  </div>
                  <div className="flex w-28 flex-col gap-1">
                    <Label htmlFor={`w-tier-p-${i}`} className="text-xs">Percent off</Label>
                    <Input id={`w-tier-p-${i}`} inputMode="numeric" value={t.percent} onChange={(e) => set({ tiers: draft.tiers.map((x, j) => (j === i ? { ...x, percent: e.target.value.replace(/\D/g, "") } : x)) })} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" disabled={draft.tiers.length === 1} onClick={() => set({ tiers: draft.tiers.filter((_, j) => j !== i) })} aria-label={`Remove tier ${i + 1}`}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {draft.tiers.length < 4 && (
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => set({ tiers: [...draft.tiers, { minItems: String((int(draft.tiers.at(-1)?.minItems ?? "1") || 1) + 1), percent: "" }] })}>
                  <Plus aria-hidden /> Add a tier
                </Button>
              )}
              <FieldError id="w-tiers-err" message={errors.tiers} />
            </fieldset>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="flex max-w-md flex-col gap-1.5">
            <Label htmlFor="w-name">Name (only you see this)</Label>
            <Input id="w-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Free gift over a minimum spend" aria-invalid={!!errors.name || undefined} aria-describedby={errors.name ? "w-name-err" : undefined} />
            <FieldError id="w-name-err" message={errors.name} />
          </div>
          <label className="flex min-h-11 max-w-md cursor-pointer items-start justify-between gap-4">
            <span className="flex flex-col">
              <span className="text-sm font-medium">Stack with other deal paths</span>
              <span className="text-xs text-muted-foreground">Off: buyers get whichever single deal saves them most. On: this adds to other stackable deals.</span>
            </span>
            <Switch checked={draft.stackable} onCheckedChange={(stackable) => set({ stackable })} aria-label="Stack with other deal paths" />
          </label>
          <label className="flex min-h-11 max-w-md cursor-pointer items-center justify-between gap-4">
            <span className="text-sm font-medium">Switched on</span>
            <Switch checked={draft.active} onCheckedChange={(active) => set({ active })} aria-label="Deal path is switched on" />
          </label>
          <fieldset className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2" aria-describedby={errors.dates ? "w-dates-err" : undefined}>
            <legend className="mb-1 text-sm font-medium">Dates {draft.when === "any" && draft.then === "percent" ? "(an end date is required)" : "(optional)"}</legend>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-start" className="text-xs">Starts</Label>
              <Input id="w-start" type="datetime-local" value={draft.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-end" className="text-xs">Ends</Label>
              <Input id="w-end" type="datetime-local" value={draft.endsAt} onChange={(e) => set({ endsAt: e.target.value })} aria-invalid={!!errors.dates || undefined} />
            </div>
            <div className="sm:col-span-2">
              <FieldError id="w-dates-err" message={errors.dates} />
            </div>
          </fieldset>
        </div>
      )}

      <div className={cn("flex flex-wrap items-center gap-2 border-t pt-4")}>
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>
            <ArrowLeft aria-hidden /> Back
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="button" className="ml-auto" onClick={next} disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {step < 2 ? (
            <>
              Next <ArrowRight aria-hidden />
            </>
          ) : draft.id ? (
            "Save changes"
          ) : (
            "Save deal path"
          )}
        </Button>
      </div>
    </div>
  );
}
