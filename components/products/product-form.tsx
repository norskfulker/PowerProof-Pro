"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/pp/currency-input";
import { FeeBreakdown } from "@/components/pp/fee-breakdown";
import { FileDrop } from "@/components/pp/file-drop";
import { kindLabel } from "@/components/pp/product-card";
import { useApi } from "@/hooks/use-api";
import { getTaxCodes } from "@/lib/api";
import { money } from "@/lib/money";
import { ImageGalleryField } from "./image-gallery-field";
import { productSchema, type ProductValues } from "./product-schema";

const KINDS = ["ebook", "template", "preset", "notion", "course", "audio", "other"] as const;

function Panel({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
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
}: {
  initial: ProductValues;
  onSubmit: (v: ProductValues) => Promise<void>;
  submitLabel?: string;
  /** Extra panels at the bottom of the sidebar (share link, danger zone). */
  aside?: React.ReactNode;
}) {
  const form = useForm<ProductValues>({ resolver: zodResolver(productSchema), defaultValues: initial, mode: "onTouched" });
  const taxCodes = useApi(getTaxCodes, []);
  const price = useWatch({ control: form.control, name: "price" });
  const title = useWatch({ control: form.control, name: "title" });
  const pending = form.formState.isSubmitting;
  const dirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (v) => {
          await onSubmit(v);
          form.reset(v);
        })}
        className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0"
      >
        <div className="flex flex-col gap-6">
          <Panel title="Details">
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

          <Panel title="Images" description="The first one is the cover on your store and in link previews.">
            <Controller
              control={form.control}
              name="images"
              render={({ field }) => <ImageGalleryField images={field.value} onChange={field.onChange} title={title} />}
            />
          </Panel>

          <Panel title="Files" description="What buyers download. Links are private and expire after 7 days; buyers can always get a fresh one.">
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
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Visibility">
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

          <Panel title="Pricing">
            <FormField
              control={form.control}
              name="price"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <CurrencyInput id="p-price" value={field.value} onChange={(m) => field.onChange(m ? { ...m, currency: "INR" } : money(0))} onBlur={field.onBlur} invalid={!!fieldState.error} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="compareAt"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Original price (optional)</FormLabel>
                  <CurrencyInput id="p-compare" value={field.value} onChange={(m) => field.onChange(m && m.amount > 0 ? { ...m, currency: "INR" } : undefined)} onBlur={field.onBlur} invalid={!!fieldState.error} />
                  <FormDescription>Shown crossed out, for launch offers.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FeeBreakdown sale={price ?? money(0)} className="border-dashed bg-surface-sunken" />
          </Panel>

          <Panel title="Organisation">
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax code (HSN/SAC)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder={taxCodes.loading ? "Loading…" : "Choose"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {taxCodes.data?.map((t) => (
                        <SelectItem key={t.code} value={t.code}>
                          <span className="font-mono">{t.code}</span> · {t.description} ({t.rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Goes on the invoice. Manage codes in Settings › Tax.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Panel>
          {aside}
        </div>

        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t bg-surface px-4 py-3 md:bottom-0 md:left-[248px] lg:static lg:col-span-2 lg:rounded-card lg:border lg:px-6">
          <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-3">
            <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">{dirty ? "Unsaved changes" : "All changes saved"}</p>
            <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={() => form.reset()}>Discard</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
