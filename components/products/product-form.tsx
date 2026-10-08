"use client";

import { createContext, useContext, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, Package, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/pp/segmented";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/pp/currency-input";
import { FileDrop } from "@/components/pp/file-drop";
import { kindLabel } from "@/components/pp/product-card";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { getCollections, getTaxCodes, saveCollection } from "@/lib/api";
import { PALETTES } from "@/lib/palettes";
import { compareAtFromPercent, discountPercent, money } from "@/lib/money";
import type { Money } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { FeeBreakdown } from "@/components/pp/fee-breakdown";
import { PricePreview } from "./price-preview";
import { BackgroundPicker } from "@/components/media/background-picker";
import { MediaUploader } from "@/components/media/media-uploader";
import { TileBackgroundView } from "@/components/media/tile-background";
import { SaveBar } from "@/components/save/save-bar";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { ImageGalleryField } from "./image-gallery-field";
import { DRAFT_NOTE, publishBlockers, readiness } from "./readiness";
import { productSchema, type ProductValues } from "./product-schema";

const CUSTOM = "__custom";

/** Make a collection without leaving the product: a name is all it needs (the tile can be styled later). */
function QuickCollection({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function create() {
    const n = name.trim();
    if (n.length < 2) return setError("Name the collection.");
    setBusy(true);
    setError(undefined);
    try {
      const list = await saveCollection({ name: n, productIds: [], cover: { template: "block", title: n, subtitle: "", ...PALETTES[0] } });
      const made = list.find((c) => c.name === n);
      if (made) onCreated(made.id);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create it.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-1.5 border-t pt-4">
      <Label htmlFor="qc-name">Make a new collection</Label>
      <div className="flex gap-2">
        <Input id="qc-name" value={name} maxLength={80} placeholder="e.g. Notebooks" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void create(); } }} />
        <Button type="button" variant="secondary" onClick={() => void create()} disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />} Create</Button>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
const KINDS = ["ebook", "template", "preset", "notion", "course", "audio", "other"] as const;

/** First product: the same panels, shown three steps at a time. `at` is the step a panel belongs to; panels with none stay out of the wizard. */
const Steps = createContext<{ wizard: boolean; step: number }>({ wizard: false, step: 0 });
const WIZARD_STEPS = ["The basics", "Images and files", "Price and publish"] as const;
/** Which step each field lives on, so a failed save can jump to the one that needs fixing */
const STEP_OF: Partial<Record<keyof ProductValues, number>> = { title: 0, description: 0, images: 1, files: 1, collectionIds: 1, price: 2, compareAt: 2, taxCode: 2, taxRate: 2, sku: 2, status: 2 };

function Panel({ title, children, description, at }: { title: string; description?: string; at?: number; children: React.ReactNode }) {
  const { wizard, step } = useContext(Steps);
  if (wizard && at !== step) return null;
  return (
    <section className="rounded-card border bg-surface p-5 md:p-6" aria-label={title}>
      <h2 className="font-sans text-base font-semibold tracking-normal">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function ProductForm({
  initial,
  onSubmit,
  submitLabel = "Save",
  aside,
  mode = "create",
  wizard = false,
}: {
  initial: ProductValues;
  onSubmit: (v: ProductValues) => Promise<void>;
  submitLabel?: string;
  /** "edit": the save bar appears only when something changed (Part 6F). "create": a Create button is always there. */
  mode?: "create" | "edit";
  /** Someone's first product: three short steps instead of every panel at once */
  wizard?: boolean;
  /** Extra panels at the bottom of the sidebar (share link, danger zone). */
  aside?: React.ReactNode;
}) {
  const form = useForm<ProductValues>({ resolver: zodResolver(productSchema), defaultValues: initial, mode: "onTouched" });
  const store = useCurrentStore();
  // Prices are set in the store's currency, which comes from the country chosen at sign-up
  const cur = store.data?.currency ?? initial.price.currency;
  const taxCodes = useApi(getTaxCodes, []);
  const collections = useApi(getCollections, []);
  const taxCode = useWatch({ control: form.control, name: "taxCode" });
  const taxRate = useWatch({ control: form.control, name: "taxRate" });
  const [customMode, setCustomMode] = useState(false);
  // A code that isn't on the list (or has a different rate) is a custom one
  const custom = customMode || (!!taxCodes.data && !taxCodes.data.some((t) => t.code === taxCode && (taxRate === undefined || t.rate === taxRate)));
  const price = useWatch({ control: form.control, name: "price" });
  const title = useWatch({ control: form.control, name: "title" });
  const compareAt = useWatch({ control: form.control, name: "compareAt" });
  const physical = useWatch({ control: form.control, name: "fulfilment" }) === "physical";
  const [step, setStep] = useState(0);
  const [coverTab, setCoverTab] = useState<"image" | "color">(initial.images.length === 0 && initial.tileBackground?.kind === "color" ? "color" : "image");
  // Digital and physical differ in the tax code (services/software vs goods) and in what's required
  const chooseType = (f: "digital" | "physical") => {
    if (f === form.getValues("fulfilment")) return;
    form.setValue("fulfilment", f, { shouldDirty: true });
    form.setValue("taxCode", f === "physical" ? "" : "998433", { shouldDirty: true });
    form.setValue("taxRate", f === "physical" ? undefined : 18, { shouldDirty: true });
  };
  const images = useWatch({ control: form.control, name: "images" });
  const status = useWatch({ control: form.control, name: "status" });
  const files = useWatch({ control: form.control, name: "files" });
  const kind = useWatch({ control: form.control, name: "kind" });
  const video = useWatch({ control: form.control, name: "video" });
  const memberOf = useWatch({ control: form.control, name: "collectionIds" });
  const todo = readiness({ fulfilment: physical ? "physical" : "digital", images: images ?? [], video, files: files ?? [], kind }, (memberOf?.length ?? 0) > 0).filter((i) => !i.done);
  const pending = form.formState.isSubmitting;
  const dirty = form.formState.isDirty;
  const values = useWatch({ control: form.control }) as ProductValues;
  const [saved, setSaved] = useState<ProductValues>(initial);
  const bar = useDirtyForm({
    value: values,
    saved,
    validate: async () => {
      const ok = await form.trigger();
      if (!ok) toast.error("Fix the highlighted fields, then save.");
      return ok;
    },
    onSave: async () => {
      const v = form.getValues();
      await onSubmit(v);
      setSaved(v);
      form.reset(v);
    },
    onDiscard: () => form.reset(saved),
    savedMessage: "Product saved",
    autosave: mode === "edit",
  });

  const submit = form.handleSubmit(
    async (v) => {
      await onSubmit(v);
      form.reset(v);
    },
    (errors) => {
      // Take the person to the first step with something to fix
      if (!wizard) return;
      const at = Math.min(...Object.keys(errors).map((k) => STEP_OF[k as keyof ProductValues] ?? 2));
      setStep(at);
    }
  );
  // What stops it going live: a file (digital) or a collection (physical)
  const blockers = publishBlockers({ fulfilment: physical ? "physical" : "digital", files: files ?? [] }, (memberOf?.length ?? 0) > 0);
  /** Make it live: on an existing product it saves by itself; on a new one it creates it live */
  async function goLive() {
    if (blockers.length) return toast.error("It can't go live yet", { description: blockers[0] });
    form.setValue("status", "published", { shouldDirty: true, shouldValidate: true });
    if (mode === "create") void submit();
  }

  return (
    <Steps.Provider value={{ wizard, step }}>
    <Form {...form}>
      <form
        noValidate
        onSubmit={submit}
        className={wizard ? "mx-auto flex w-full max-w-2xl flex-col gap-6 pb-24 lg:pb-0" : "grid grid-cols-1 gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0"}
      >
        {!wizard && (
          <div className="sticky top-2 z-30 flex flex-col gap-3 lg:col-span-2">
            {mode === "edit" ? (
              <SaveBar state={bar} className="max-md:static max-md:border md:bg-surface md:shadow-pop" />
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-control border bg-surface px-4 py-2 shadow-pop">
                <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">{dirty ? "Unsaved changes" : "Nothing entered yet"}</p>
                <Button type="button" variant="ghost" size="sm" disabled={!dirty || pending} onClick={() => form.reset()}>Discard</Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" aria-hidden />}
                  {submitLabel}
                </Button>
              </div>
            )}
          </div>
        )}
        {!wizard && status === "draft" && (
          <div role="note" className="flex flex-col gap-1 rounded-control border border-warning/40 bg-warning-soft px-4 py-3 text-sm lg:col-span-2">
            <p className="font-semibold">{DRAFT_NOTE}</p>
            {todo.length > 0 && <p className="text-muted-foreground">Still needed: {todo.map((t) => t.label.toLowerCase()).join(", ")}.</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" onClick={goLive} disabled={pending} data-coach="publish-product">
                <Rocket aria-hidden /> {mode === "create" ? "Create and make it live" : "Make it live"}
              </Button>
              {blockers.length > 0 && <span className="text-muted-foreground">{blockers[0]}</span>}
            </div>
          </div>
        )}
        {wizard && (
          <ol className="flex items-center gap-2 text-sm" aria-label="Steps">
            {WIZARD_STEPS.map((label, i) => (
              <li key={label} aria-current={i === step ? "step" : undefined} className={i === step ? "flex flex-1 flex-col gap-1.5 font-semibold text-foreground" : "flex flex-1 flex-col gap-1.5 text-muted-foreground"}>
                <span className={i <= step ? "h-1 rounded-full bg-primary" : "h-1 rounded-full bg-muted"} aria-hidden />
                <span className="flex items-center gap-1.5">
                  {i < step ? <Check className="size-3.5 text-primary" aria-hidden /> : <span className="font-mono text-xs">{i + 1}</span>}
                  {label}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className={wizard ? "contents" : "flex flex-col gap-6"}>
          <Panel title="Details" at={0}>
            {wizard ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">What are you selling?</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {([["digital", "Digital product", "A file buyers download.", FileUp], ["physical", "Physical product", "Something you ship.", Package]] as const).map(([value, label, hint, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={(physical ? "physical" : "digital") === value}
                      onClick={() => chooseType(value)}
                      className={(physical ? "physical" : "digital") === value ? "flex min-h-16 items-center gap-3 rounded-control border-2 border-primary bg-primary-soft p-3 text-left" : "flex min-h-16 items-center gap-3 rounded-control border p-3 text-left hover:border-primary"}
                    >
                      <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                      <span><span className="block font-semibold">{label}</span><span className="block text-sm text-muted-foreground">{hint}</span></span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{physical ? "Physical product" : "Digital product"}</p>
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={6} className="min-h-36" {...field} /></FormControl>
                  <FormDescription>What&apos;s inside, who it&apos;s for, what they get after paying.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Panel>

          <Panel title="Images" at={1} description="Add pictures, or pick a colour for the card until you have one. The first image is the cover on your store and in link previews.">
            <Segmented
              label="Cover type"
              value={coverTab}
              onChange={setCoverTab}
              options={[{ value: "image", label: images?.length ? `Image upload (${images.length})` : "Image upload" }, { value: "color", label: "Colour" }]}
            />
            {coverTab === "image" ? (
              <Controller
                control={form.control}
                name="images"
                render={({ field }) => <ImageGalleryField images={field.value} onChange={field.onChange} title={title} />}
              />
            ) : (
              <Controller
                control={form.control}
                name="tileBackground"
                render={({ field }) => (
                  <>
                    <BackgroundPicker
                      label="Card colour"
                      modes={["color"]}
                      value={field.value?.kind === "color" ? field.value : { kind: "color", color: "#0F3D33" }}
                      onChange={field.onChange}
                      preview={(bg, text) => (
                        <TileBackgroundView bg={bg} className="grid aspect-[4/3] place-items-end rounded-media p-3">
                          <span className="font-display text-lg leading-tight [overflow-wrap:anywhere]" style={{ color: text }}>{title || "Your product"}</span>
                        </TileBackgroundView>
                      )}
                    />
                    {images && images.length > 0 && <p className="text-sm text-muted-foreground">The colour is only used while the product has no images.</p>}
                  </>
                )}
              />
            )}
          </Panel>

          <Panel title="Video" description="Optional. Shown in the product gallery after the images.">
            <Controller
              control={form.control}
              name="video"
              render={({ field }) => <MediaUploader label="Product video" kinds={["video"]} aspect="16:9" value={field.value} onChange={field.onChange} />}
            />
          </Panel>

          {!physical && (
          <Panel title="Files" at={1} description="What buyers download. Links are private and expire after 7 days; buyers can always get a fresh one.">
              <FormField
                control={form.control}
                name="files"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Files</FormLabel>
                    <FileDrop files={field.value} onChange={field.onChange} invalid={!!fieldState.error} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Panel>
          )}
        </div>

        <div className={wizard ? "contents" : "flex flex-col gap-6"}>
          <Panel title="Visibility" at={2}>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <label className="flex min-h-11 items-center justify-between gap-3">
                    <span>
                      <span className="block font-medium">{field.value === "published" ? "Live on your store" : field.value === "archived" ? "Archived" : "Draft"}</span>
                      <span className="block text-sm text-muted-foreground">{field.value === "published" ? "Anyone with the link can buy." : "Only you can see it."}</span>
                    </span>
                    <FormControl>
                      <Switch checked={field.value === "published"} onCheckedChange={(c) => field.onChange(c ? "published" : "draft")} aria-label="Publish" />
                    </FormControl>
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Panel>

          <Panel title="Pricing" at={2}>
            <FormField
              control={form.control}
              name="price"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <CurrencyInput id="p-price" currency={cur} value={field.value} onChange={(m) => field.onChange(m ? { ...m, currency: cur } : money(0, cur))} onBlur={field.onBlur} invalid={!!fieldState.error} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-3 rounded-control border bg-surface-sunken p-4">
              <label className="flex min-h-11 items-center justify-between gap-3">
                <span>
                  <span className="block font-medium">Show a discount</span>
                  <span className="block text-sm text-muted-foreground">Shows the original price crossed out, with a &quot;% off&quot; badge.</span>
                </span>
                <Switch
                  checked={!!compareAt}
                  aria-label="Show a discount"
                  onCheckedChange={(on) => form.setValue("compareAt", on ? compareAtFromPercent(price ?? money(0, cur), 20) as ProductValues["compareAt"] : undefined, { shouldDirty: true, shouldValidate: true })}
                />
              </label>
              {compareAt && <PricePreview price={price ?? money(0, cur)} compareAt={compareAt as Money} />}
              {compareAt && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="p-percent">Discount (% off)</Label>
                    <div className="relative">
                      <Input
                        id="p-percent"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={90}
                        className="pr-8"
                        value={discountPercent(price ?? money(0, cur), compareAt) || ""}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (n >= 1 && n <= 90) form.setValue("compareAt", compareAtFromPercent(price ?? money(0, cur), n) as ProductValues["compareAt"], { shouldDirty: true, shouldValidate: true });
                        }}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="compareAt"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Original price</FormLabel>
                        <CurrencyInput id="p-compare" currency={cur} value={field.value} onChange={(m) => field.onChange(m && m.amount > 0 ? { ...m, currency: cur } : undefined)} onBlur={field.onBlur} invalid={!!fieldState.error} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
            <FeeBreakdown sale={price ?? money(0, cur)} className="border-dashed bg-surface-sunken" />
          </Panel>

          <Panel title="Organisation" at={physical ? 2 : undefined}>
            {!physical && (
            <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {KINDS.map((k) => <SelectItem key={k} value={k}>{kindLabel(k)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl><Input className="font-mono" placeholder="Leave blank to auto-create" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxCode"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Tax code (HSN/SAC)</FormLabel>
                  <Select
                    value={custom ? CUSTOM : String(field.value)}
                    onValueChange={(v) => {
                      if (v === CUSTOM) return setCustomMode(true);
                      const t = taxCodes.data?.find((x) => x.code === v);
                      setCustomMode(false);
                      field.onChange(v);
                      if (t) form.setValue("taxRate", t.rate, { shouldDirty: true });
                    }}
                  >
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder={taxCodes.loading ? "Loading…" : "Choose"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {taxCodes.data?.map((t) => (
                        <SelectItem key={`${t.code}:${t.rate}`} value={t.code}>
                          <span className="font-mono">{t.code}</span> · {t.description} ({t.rate}%)
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM}>Custom code…</SelectItem>
                    </SelectContent>
                  </Select>
                  {custom && (
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="p-hsn">Your code</Label>
                        <Input id="p-hsn" className="font-mono" inputMode="numeric" maxLength={8} placeholder="e.g. 998439" value={field.value} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))} aria-invalid={!!fieldState.error || undefined} />
                      </div>
                      <FormField
                        control={form.control}
                        name="taxRate"
                        render={({ field: rate, fieldState: rs }) => (
                          <FormItem>
                            <FormLabel>GST rate (%)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={40} step="0.5" inputMode="decimal" value={rate.value ?? ""} onChange={(e) => rate.onChange(e.target.value === "" ? undefined : Number(e.target.value))} aria-invalid={!!rs.error || undefined} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  <FormDescription>Goes on the invoice. Pick a listed code, or add your own with its GST rate.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Panel>
          <Panel title={physical ? "Collection (required)" : "Add to collection"} at={physical ? 1 : undefined} description={physical ? "Physical products live in a collection so buyers can find them. Pick one, or make one here." : "Optional. Collections just help organize products; you can sell without one."}>
            <Controller
              control={form.control}
              name="collectionIds"
              render={({ field }) =>
                collections.error ? (
                  <p role="alert" className="text-sm text-danger">We couldn&apos;t load your collections. <button type="button" className="underline underline-offset-4" onClick={collections.reload}>Try again</button></p>
                ) : !collections.data ? (
                  <p className="min-h-11 text-sm text-muted-foreground">Loading collections…</p>
                ) : collections.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No collections yet. <Link href="/catalog/collections" className="font-medium text-primary underline underline-offset-4">Make one</Link> whenever you like.
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {collections.data.map((c) => {
                      const on = (field.value ?? []).includes(c.id);
                      return (
                        <li key={c.id}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-sm hover:bg-muted">
                            <Checkbox checked={on} onCheckedChange={(v) => field.onChange(v ? [...(field.value ?? []), c.id] : (field.value ?? []).filter((x) => x !== c.id))} />
                            <span className="truncate">{c.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )
              }
            />
            {form.formState.errors.collectionIds?.message && <p role="alert" className="text-sm font-medium text-danger">{form.formState.errors.collectionIds.message}</p>}
            <QuickCollection
              onCreated={(id) => {
                collections.reload();
                form.setValue("collectionIds", [...(form.getValues("collectionIds") ?? []), id], { shouldDirty: true, shouldValidate: true });
              }}
            />
          </Panel>
          {!wizard && aside}
        </div>

        {wizard ? (
          <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t bg-surface px-4 py-3 md:bottom-0 md:left-[248px] lg:static lg:rounded-card lg:border lg:px-6">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
              <Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => setStep((n) => n - 1)}>
                <ArrowLeft aria-hidden /> Back
              </Button>
              <p className="text-sm text-muted-foreground" aria-live="polite">Step {step + 1} of {WIZARD_STEPS.length}</p>
              {step < WIZARD_STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={async () => {
                    const fields: (keyof ProductValues)[] = step === 0 ? ["title", "description"] : physical ? ["collectionIds"] : ["images"];
                    if (await form.trigger(fields)) setStep((n) => n + 1);
                  }}
                >
                  Next <ArrowRight aria-hidden />
                </Button>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="submit" variant="secondary" disabled={pending} onClick={() => form.setValue("status", "draft")}>
                    Save as draft
                  </Button>
                  <Button type="button" disabled={pending} onClick={goLive} title={blockers[0]}>
                    {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Create and make it live
                  </Button>
                </div>
              )}
            </div>
            {step === WIZARD_STEPS.length - 1 && blockers.length > 0 && <p className="mx-auto mt-2 max-w-2xl text-right text-sm text-muted-foreground">To go live: {blockers[0].toLowerCase()} Or save it as a draft and finish later.</p>}
          </div>
        ) : null}
      </form>
    </Form>
    </Steps.Provider>
  );
}
