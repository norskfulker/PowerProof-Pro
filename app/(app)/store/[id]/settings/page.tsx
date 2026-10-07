"use client";

import { readableOn } from "@/lib/color";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BrandColorPicker } from "@/components/pp/brand-color-picker";
import { MediaUploader } from "@/components/media/media-uploader";
import { MediaImg } from "@/components/media/tile-background";
import { SaveBar } from "@/components/save/save-bar";
import { SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { useFormSaveBar } from "@/hooks/use-dirty-form";
import { useCurrentStore } from "@/hooks/use-current-store";
import { updateStore } from "@/lib/api";
import { SITE_URL } from "@/lib/format";
import type { Store } from "@/lib/types";
import { initialsOf } from "@/lib/slug";

const schema = z.object({
  name: z.string().trim().min(2, "Your store needs a name."),
  slug: z.string().min(3, "At least 3 characters.").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes."),
  tagline: z.string().max(120, "Keep it under 120 characters."),
  brandColor: z.string(),
  supportEmail: z.string().email("Buyers need a working email for help."),
  refundDays: z.coerce.number(),
  refundPolicy: z.string().trim().min(20, "Say in a sentence or two when buyers get their money back."),
  logo: z.object({ src: z.string(), alt: z.string() }).optional(),
});

type Values = z.input<typeof schema>;

function StoreForm({ store, onSaved }: { store: Store; onSaved: (s: Store) => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { ...store }, mode: "onTouched" });
  const [name, brandColor, tagline, logo] = useWatch({ control: form.control, name: ["name", "brandColor", "tagline", "logo"] });
  const bar = useFormSaveBar(
    form,
    async (raw) => {
      const v = schema.parse(raw);
      try {
        const s = await updateStore(v);
        onSaved(s);
      } catch (e) {
        form.setError("slug", { message: e instanceof Error ? e.message : "Couldn't save." });
        throw e;
      }
    },
    "Store details saved"
  );

  return (
    <Form {...form}>
      <form
        id="store"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          bar.save();
        }}
        className="flex flex-col gap-6"
      >
        <SettingsSection title="Branding" description="What buyers see at the top of your store and on receipts." saveBar={<SaveBar state={bar} />}>
          <div className="mb-6 flex items-center gap-4 rounded-card border bg-background p-4" aria-label="Preview">
            {logo?.src ? (
              <span className="relative size-12 shrink-0 overflow-hidden rounded-[12px]"><MediaImg src={logo.src} alt={logo.alt || "Logo"} className="absolute inset-0" /></span>
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-[12px] font-mono text-sm font-semibold" style={{ background: brandColor, color: readableOn(brandColor) }}>{initialsOf(name)}</span>
            )}
            <span className="min-w-0">
              <span className="block font-display text-xl">{name || "Your store"}</span>
              <span className="block truncate text-sm text-muted-foreground">{tagline || "A short line about what you make."}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem data-coach="store-name"><FormLabel>Store name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="slug" render={({ field }) => (
              <FormItem><FormLabel>Store link</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl><FormDescription>{SITE_URL}/{field.value}. Old links redirect for 90 days.</FormDescription><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="tagline" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Tagline</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Controller control={form.control} name="logo" render={({ field }) => (
              <div className="sm:col-span-2">
                <MediaUploader compact label="Logo (optional)" kinds={["image"]} aspect="1:1" withFocal={false} hint="Square works best" value={field.value ? { ...field.value, kind: "image" } : undefined} onChange={(m) => field.onChange(m ? { src: m.src, alt: m.alt } : undefined)} />
              </div>
            )} />
            <Controller control={form.control} name="brandColor" render={({ field }) => (
              <BrandColorPicker value={field.value} onChange={field.onChange} />
            )} />
          </div>
        </SettingsSection>

        <SettingsSection title="Help and refunds" description="Shown on every buyer page, receipt and download page.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="supportEmail" render={({ field }) => (
              <FormItem><FormLabel>Support email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="refundDays" render={({ field }) => (
              <FormItem>
                <FormLabel>Refund window</FormLabel>
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{[0, 3, 7, 14, 30].map((d) => <SelectItem key={d} value={String(d)}>{d === 0 ? "No refunds" : `${d} days`}</SelectItem>)}</SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="refundPolicy" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Refund policy</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
        </SettingsSection>
      </form>
      <SettingsSection title="Address and domain" description="Your free powerproof.store address, and your own domain on Pro.">
        <Button asChild variant="secondary" className="self-start">
          <Link href={`/store/${store.id}/domain`}>
            <Globe aria-hidden /> Manage domain
          </Link>
        </Button>
      </SettingsSection>
    </Form>
  );
}

export default function StoreSettingsPage() {
  const { data, error, reload, setData } = useCurrentStore();
  if (!data) return <SettingsLoading error={error} onRetry={reload} />;
  return <StoreForm store={data} onSaved={setData} />;
}
