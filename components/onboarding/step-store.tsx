"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Check, Loader2, X } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, currencyFor, DEFAULT_COUNTRY } from "@/lib/countries";
import { CURRENCIES } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/auth/auth-card";
import { BrandColorPicker } from "@/components/pp/brand-color-picker";
import { checkSlug, createStore, suggestSlug, WORKSPACE_NAME_MAX } from "@/lib/api";
import { SITE_URL } from "@/lib/format";
import { cleanStoreName, STORE_NAME_MAX, storeNameError } from "@/lib/slug";
import { normalizeHex } from "@/lib/color";
import { PALETTES } from "@/lib/palettes";
import { StepFrame } from "./step-frame";

interface Values {
  workspace: string;
  name: string;
  country: string;
  brandColor: string;
}

type LinkState = { for: string; slug?: string; available?: boolean; failed?: boolean };

export function StepStore({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string>();
  const [link, setLink] = useState<LinkState | null>(null);
  const form = useForm<Values>({ defaultValues: { workspace: "", name: "", country: DEFAULT_COUNTRY, brandColor: PALETTES[0].bg }, mode: "onTouched" });
  const name = useWatch({ control: form.control, name: "name" });
  const clean = cleanStoreName(name ?? "");
  const valid = storeNameError(clean) === null;

  // The link comes from the database, never from the browser: it knows the length limit, reserved
  // words, collisions and non-Latin names. Then the database confirms it's free.
  useEffect(() => {
    if (!valid) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const slug = await suggestSlug(clean);
        if (alive) setLink({ for: clean, slug });
        const r = await checkSlug(slug);
        if (alive) setLink({ for: clean, slug, available: r.available });
      } catch {
        if (alive) setLink({ for: clean, failed: true });
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [clean, valid]);

  const current = valid && link?.for === clean ? link : null;
  const waiting = valid && (!current || (current.slug !== undefined && current.available === undefined && !current.failed));
  const ready = Boolean(current?.slug && current.available);

  return (
    <StepFrame formId="step-store" title="Create your workspace" description="Your workspace holds your stores, products, marketplace deals, agents and team. Name it, then name its first store. You can add more stores later." submitLabel="Create workspace" pending={form.formState.isSubmitting} disabled={!ready}>
      <Form {...form}>
        <form
          id="step-store"
          noValidate
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(async (v) => {
            setError(undefined);
            const nameError = storeNameError(v.name);
            if (nameError) return form.setError("name", { message: nameError });
            const color = normalizeHex(v.brandColor);
            if (!color) return setError("Pick a colour as #RRGGBB.");
            if (!ready || !current?.slug) return;
            try {
              await createStore({ workspaceName: v.workspace, name: cleanStoreName(v.name), brandColor: color, slug: current.slug, country: v.country });
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          })}
        >
          <FormError message={error} />
          <FormField
            control={form.control}
            name="workspace"
            rules={{ validate: (v) => (v.trim().length < 2 ? "Give your workspace a name." : v.trim().length > WORKSPACE_NAME_MAX ? `Keep it under ${WORKSPACE_NAME_MAX} characters.` : true) }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Workspace name</FormLabel>
                <FormControl>
                  <Input autoFocus maxLength={WORKSPACE_NAME_MAX} autoComplete="organization" placeholder="Your business or team" {...field} />
                </FormControl>
                <FormDescription>Usually your business name. Everyone you invite joins the workspace.</FormDescription>
                <div className="min-h-5"><FormMessage /></div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            rules={{ validate: (v) => storeNameError(v) ?? true }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>First store name</FormLabel>
                <FormControl>
                  <Input maxLength={STORE_NAME_MAX + 10} autoComplete="off" {...field} />
                </FormControl>
                <div className="min-h-5"><FormMessage /></div>
              </FormItem>
            )}
          />
          <div aria-live="polite" className="min-h-14 rounded-control border bg-surface-sunken px-3 py-2">
            <p className="text-xs text-muted-foreground">Your store link</p>
            <p className="flex min-h-6 items-center gap-1.5 font-mono text-[0.8125rem] break-all">
              {current?.slug ? (
                <>
                  <span className="min-w-0">{SITE_URL}/{current.slug}</span>
                  {current.available === undefined ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-label="Checking" /> : current.available ? <Check className="size-3.5 shrink-0 text-success" aria-label="Available" /> : <X className="size-3.5 shrink-0 text-danger" aria-label="Taken" />}
                </>
              ) : current?.failed ? (
                <span className="text-danger">We couldn&apos;t make a link just now. Change the name slightly or try again.</span>
              ) : waiting ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Making your link" />
              ) : (
                <span className="text-muted-foreground">{SITE_URL}/…</span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Free forever. Want an address you own, like shop.yourname.in? Connect it later in Settings › Domain.</p>
          </div>
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Where are you based?</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormDescription>
                  You&apos;ll set your prices in <strong>{CURRENCIES[currencyFor(field.value)].name}s ({currencyFor(field.value)})</strong>. This is fixed once you add products.
                </FormDescription>
              </FormItem>
            )}
          />
          <details className="rounded-control border px-3 py-2 text-sm">
            <summary className="min-h-9 cursor-pointer font-medium pointer-coarse:min-h-11">Pick a colour (optional)</summary>
            <div className="pt-3">
              <FormField control={form.control} name="brandColor" render={({ field }) => <BrandColorPicker value={field.value} onChange={field.onChange} />} />
            </div>
          </details>
        </form>
      </Form>
    </StepFrame>
  );
}
