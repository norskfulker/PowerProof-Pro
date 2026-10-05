"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Loader2, X } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/auth/auth-card";
import { checkSlug, updateStore } from "@/lib/api";
import { SITE_URL } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { StepFrame } from "./step-frame";

const schema = z.object({
  name: z.string().trim().min(2, "Give your store a name. You can change it later."),
  slug: z
    .string()
    .min(3, "Store links need at least 3 characters.")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes."),
});

export function StepStore({ initial, onDone }: { initial: { name: string; slug: string }; onDone: () => void }) {
  const [error, setError] = useState<string>();
  const [availability, setAvailability] = useState<{ slug: string; ok: boolean; suggestion?: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: initial, mode: "onTouched" });
  const slug = useWatch({ control: form.control, name: "slug" });

  useEffect(() => {
    if (slug.length < 3) return;
    let alive = true;
    const t = setTimeout(() => {
      checkSlug(slug).then((r) => alive && setAvailability({ slug, ok: r.available, suggestion: r.suggestion }));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [slug]);

  const checking = slug.length >= 3 && availability?.slug !== slug;
  const taken = availability?.slug === slug && !availability.ok;

  return (
    <StepFrame
      formId="step-store"
      title="Name your store"
      description="This is what buyers see. Both can change later."
      timeLeft="About 3 minutes to go"
      pending={form.formState.isSubmitting}
    >
      <Form {...form}>
        <form
          id="step-store"
          noValidate
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(async (v) => {
            if (taken) return;
            setError(undefined);
            try {
              await updateStore({ name: v.name.trim(), slug: v.slug, logoText: v.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() });
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          })}
        >
          <FormError message={error} />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Store name</FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      if (!slugTouched) form.setValue("slug", slugify(e.target.value));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Store link</FormLabel>
                <div className="flex items-stretch overflow-hidden rounded-control border border-input bg-surface focus-within:border-primary focus-within:outline-2 focus-within:outline-primary">
                  <span className="flex min-w-0 shrink items-center truncate border-r bg-surface-sunken px-3 font-mono text-[0.8125rem] whitespace-nowrap text-muted-foreground [overflow-wrap:normal]" title={`${SITE_URL}/`}>{SITE_URL}/</span>
                  <FormControl>
                    <input
                      {...field}
                      onChange={(e) => {
                        setSlugTouched(true);
                        field.onChange(slugify(e.target.value.replace(/\s/g, "-")) + (e.target.value.endsWith("-") ? "-" : ""));
                      }}
                      autoCapitalize="none"
                      spellCheck={false}
                      className="h-11 min-w-[9rem] flex-1 bg-transparent px-3 font-mono text-[0.9375rem] outline-none"
                    />
                  </FormControl>
                  <span className="flex w-11 items-center justify-center" aria-hidden>
                    {checking ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : taken ? (
                      <X className="size-4 text-danger" />
                    ) : slug.length >= 3 ? (
                      <Check className="size-4 text-success" />
                    ) : null}
                  </span>
                </div>
                <FormDescription aria-live="polite">
                  {taken ? (
                    <span className="font-medium text-danger">
                      Taken.{" "}
                      {availability?.suggestion && (
                        <button type="button" className="underline underline-offset-4" onClick={() => form.setValue("slug", availability.suggestion!)}>
                          Use {availability.suggestion}
                        </button>
                      )}
                    </span>
                  ) : checking ? (
                    "Checking…"
                  ) : slug.length >= 3 ? (
                    "It's yours."
                  ) : (
                    "Lowercase letters, numbers and dashes."
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </StepFrame>
  );
}
