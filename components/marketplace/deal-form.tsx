"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { CurrencyInput } from "@/components/pp/currency-input";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SaveBar } from "@/components/save/save-bar";
import { useFormSaveBar } from "@/hooks/use-dirty-form";
import type { Deal, DealInput, MyDeal } from "@/lib/api";
import { discountPercent, fromMajor, money } from "@/lib/money";
import type { CurrencyCode, Product } from "@/lib/types";
import { DealCard } from "./deal-card";

const moneySchema = z.object({ amount: z.number().int(), currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"]) });

export const dealSchema = z
  .object({
    productId: z.string().min(1, "Pick the product this deal is for."),
    title: z.string().trim().min(3, "Give the deal a name of at least 3 characters.").max(80, "Keep it under 80 characters."),
    pitch: z.string().trim().min(20, "Say a bit more: at least a sentence.").max(400, "Keep it under 400 characters."),
    billing: z.enum(["one_time", "subscription"]),
    interval: z.enum(["month", "year"]).optional(),
    original: moneySchema,
    price: moneySchema,
    endsAt: z.string().optional(),
    showRevenue: z.boolean(),
    status: z.enum(["live", "paused"]),
  })
  .refine((v) => v.price.amount > 0, { path: ["price"], message: "Set the deal price." })
  .refine((v) => v.original.amount > v.price.amount, { path: ["original"], message: "The original price should be higher than your price." })
  .refine((v) => v.billing === "one_time" || !!v.interval, { path: ["interval"], message: "Say how often it is charged." })
  .refine((v) => !v.endsAt || Date.parse(v.endsAt) > Date.now(), { path: ["endsAt"], message: "Pick a time in the future." });

export type DealValues = z.infer<typeof dealSchema>;

export const toInput = (v: DealValues): DealInput => ({
  productId: v.productId,
  title: v.title,
  pitch: v.pitch,
  billing: v.billing,
  interval: v.billing === "subscription" ? v.interval ?? "month" : undefined,
  original: v.original,
  price: v.price,
  endsAt: v.endsAt || undefined,
  showRevenue: v.showRevenue,
  status: v.status,
});

export function valuesFromDeal(d: MyDeal): DealValues {
  return { productId: d.productId, title: d.title, pitch: d.pitch, billing: d.billing, interval: d.interval, original: d.original, price: d.price, endsAt: d.endsAt, showRevenue: d.showRevenue, status: d.status };
}

/** A starting point from the product: its price, its crossed-out price if it has one, else 40% more */
export function startingDeal(p: Product, currency: CurrencyCode): DealValues {
  const original = p.compareAt && p.compareAt.amount > p.price.amount ? p.compareAt : money(Math.round((p.price.amount * 1.4) / 100) * 100, p.price.currency);
  return { productId: p.id, title: p.title.slice(0, 80), pitch: p.description.slice(0, 400), billing: "one_time", original: { ...original, currency }, price: { ...p.price, currency }, showRevenue: true, status: "live" };
}

const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

/**
 * List a product as a marketplace deal: one-time or subscription, the original price and your
 * price, and whether to show what it earns. The card on the side is exactly what buyers see.
 * New deals are created with a button; an existing deal saves itself.
 */
export function DealForm({
  initial,
  products,
  currency,
  storeName,
  onSubmit,
  mode,
  submitLabel = "List this deal",
}: {
  initial: DealValues;
  /** Live products that can carry a deal */
  products: Product[];
  currency: CurrencyCode;
  storeName: string;
  onSubmit: (v: DealValues) => Promise<void>;
  mode: "create" | "edit";
  submitLabel?: string;
}) {
  const form = useForm<DealValues>({ resolver: zodResolver(dealSchema), defaultValues: initial, mode: "onTouched" });
  const bar = useFormSaveBar(form, async (v) => onSubmit(v), "Deal saved", { autosave: mode === "edit" });
  const v = useWatch({ control: form.control }) as DealValues;
  const billing = v.billing;
  const product = products.find((p) => p.id === v.productId);
  const [error, setError] = useState<string>();
  const pending = form.formState.isSubmitting;

  const preview: Deal = useMemo(
    () => ({
      id: "preview",
      title: v.title || "Your deal",
      pitch: v.pitch || "What buyers get, in a sentence or two.",
      billing,
      interval: billing === "subscription" ? v.interval ?? "month" : undefined,
      original: v.original ?? money(0, currency),
      price: v.price ?? money(0, currency),
      percentOff: v.original && v.price ? discountPercent(v.price, v.original) : 0,
      productSlug: product?.slug ?? "",
      storeName,
      storeSlug: "",
      country: "IN",
      fulfilment: product?.fulfilment ?? "digital",
      kind: product?.kind ?? "other",
      cover: product?.images[0]?.src,
      coverBg: product?.tileBackground?.kind === "color" ? product.tileBackground.color : "#0F3D33",
      verified: false,
      trusted: false,
      sold: product?.salesCount ?? 0,
      revenue: v.showRevenue ? product?.revenue : undefined,
      reviews: 0,
      endsAt: v.endsAt || undefined,
      createdAt: new Date().toISOString(),
    }),
    [v, billing, product, storeName, currency]
  );

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setError(undefined);
          try {
            await onSubmit(values);
          } catch (e) {
            setError(e instanceof Error ? e.message : "That didn't save.");
          }
        })}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="sticky top-2 z-30 flex flex-col gap-3 lg:col-span-2">
          {mode === "edit" ? (
            <SaveBar state={bar} className="max-md:static max-md:border md:bg-surface md:shadow-pop" />
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-control border bg-surface px-4 py-2 shadow-pop">
              <p className="mr-auto text-sm text-muted-foreground">{error ? <span className="font-medium text-danger">{error}</span> : "Buyers see the card on the right."}</p>
              <Button type="button" variant="ghost" size="sm" disabled={!form.formState.isDirty || pending} onClick={() => form.reset()}>Discard</Button>
              <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} {submitLabel}</Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section aria-label="The deal" className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
            <h2 className="font-sans text-base font-semibold tracking-normal">The deal</h2>
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select
                    value={field.value}
                    disabled={mode === "edit"}
                    onValueChange={(id) => {
                      const p = products.find((x) => x.id === id);
                      if (!p) return;
                      form.reset({ ...startingDeal(p, currency), billing: form.getValues("billing"), interval: form.getValues("interval") }, { keepDefaultValues: false });
                    }}
                  >
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder={products.length ? "Choose a live product" : "No live product without a deal"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} · {p.fulfilment === "physical" ? "Physical" : "Digital"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormDescription>Buyers pay this product&apos;s price, so saving the deal sets the product to the prices below.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Deal name</FormLabel><FormControl><Input maxLength={80} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="pitch" render={({ field }) => (<FormItem><FormLabel>Why it&apos;s a good deal</FormLabel><FormControl><Textarea rows={4} maxLength={400} {...field} /></FormControl><FormDescription>What buyers get and why now. Up to 400 characters.</FormDescription><FormMessage /></FormItem>)} />
          </section>

          <section aria-label="Payment and price" className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
            <h2 className="font-sans text-base font-semibold tracking-normal">Payment and price</h2>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">How buyers pay</span>
              <Controller
                control={form.control}
                name="billing"
                render={({ field }) => (
                  <Segmented label="How buyers pay" value={field.value} onChange={(b) => { field.onChange(b); form.setValue("interval", b === "subscription" ? "month" : undefined, { shouldDirty: true }); }} options={[{ value: "one_time", label: "One-time payment" }, { value: "subscription", label: "Subscription" }]} />
                )}
              />
            </div>
            {billing === "subscription" && (
              <FormField
                control={form.control}
                name="interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charged every</FormLabel>
                    <Select value={field.value ?? "month"} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="month">Month</SelectItem><SelectItem value="year">Year</SelectItem></SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="original" render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Original price{billing === "subscription" ? ` (per ${v.interval ?? "month"})` : ""}</FormLabel>
                  <CurrencyInput id="d-original" currency={currency} value={field.value} onChange={(m) => field.onChange(m ? { ...m, currency } : fromMajor(0, currency))} onBlur={field.onBlur} invalid={!!fieldState.error} />
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Our price{billing === "subscription" ? ` (per ${v.interval ?? "month"})` : ""}</FormLabel>
                  <CurrencyInput id="d-price" currency={currency} value={field.value} onChange={(m) => field.onChange(m ? { ...m, currency } : fromMajor(0, currency))} onBlur={field.onBlur} invalid={!!fieldState.error} />
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="endsAt" render={({ field }) => (
              <FormItem>
                <FormLabel>Ends (optional)</FormLabel>
                <FormControl><Input type="datetime-local" value={toLocal(field.value)} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)} className="w-full sm:w-64" /></FormControl>
                <FormDescription>The deal leaves the marketplace after this time.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </section>

          <section aria-label="Trust" className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
            <h2 className="font-sans text-base font-semibold tracking-normal">Trust</h2>
            <FormField control={form.control} name="showRevenue" render={({ field }) => (
              <FormItem>
                <label className="flex min-h-11 items-center justify-between gap-3">
                  <span>
                    <span className="block font-medium">Show what this product earns</span>
                    <span className="block text-sm text-muted-foreground">Buyers see its total and last-30-day revenue, worked out from your paid orders on PowerProof. It builds trust; you can turn it off any time.</span>
                  </span>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Show revenue" /></FormControl>
                </label>
              </FormItem>
            )} />
            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">Verified</strong> is added by PowerProof staff after they check you and the deal. <strong className="font-medium text-foreground">Trusted seller</strong> is earned: at least 5 paid orders, few refunds and good reviews.
            </p>
            {mode === "edit" && (
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <label className="flex min-h-11 items-center justify-between gap-3">
                    <span><span className="block font-medium">{field.value === "live" ? "Showing in the marketplace" : "Paused"}</span><span className="block text-sm text-muted-foreground">Pause it to hide the deal without deleting it.</span></span>
                    <FormControl><Switch checked={field.value === "live"} onCheckedChange={(on) => field.onChange(on ? "live" : "paused")} aria-label="Show in the marketplace" /></FormControl>
                  </label>
                </FormItem>
              )} />
            )}
          </section>
        </div>

        <aside aria-label="How it looks" className="flex flex-col gap-2 lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">How it looks</p>
          <DealCard d={preview} preview />
        </aside>
      </form>
    </Form>
  );
}
