"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/auth/auth-card";
import { useStorefront } from "@/components/storefront/storefront-context";
import { sendContactMessage } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(2, "Tell us your name."),
  email: z.string().email("That email looks off. Check for typos."),
  order: z.string().optional(),
  message: z.string().trim().min(10, "Tell us a little more so we can help."),
});

export default function StoreContactPage() {
  const { view, slug } = useStorefront();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", order: "", message: "" }, mode: "onTouched" });

  return (
    <div className="mx-auto grid max-w-[1000px] grid-cols-1 gap-10 px-4 pt-10 md:grid-cols-[1fr_1.3fr] md:px-6 md:pt-16">
      <title>{`Contact · ${view.store.name}`}</title>
      <div>
        <h1 className="text-[2.5rem] leading-tight md:text-5xl">Get in touch.</h1>
        <p className="mt-3 text-lg text-muted-foreground">{view.pages.contactNote}</p>
        <ul className="mt-6 flex flex-col gap-3 text-sm">
          <li><a href={`mailto:${view.store.supportEmail}`} className="inline-flex min-h-11 max-w-full items-center gap-2 font-medium hover:underline"><Mail className="size-4 shrink-0" aria-hidden /><span className="min-w-0 break-all">{view.store.supportEmail}</span></a></li>
          <li>Lost your download? <Link href="/lookup" className="font-medium underline underline-offset-4">Find your order</Link>.</li>
          <li>Refunds: see the <Link href={`/s/${slug}/policies/refund`} className="font-medium underline underline-offset-4">refund policy</Link>.</li>
        </ul>
      </div>
      {sent ? (
        <div className="flex flex-col items-start gap-3 rounded-card border bg-surface p-6" role="status">
          <CheckCircle2 className="size-6 text-success" aria-hidden />
          <p className="font-display text-xl">Message sent.</p>
          <p className="text-muted-foreground">{view.design.about.name.split(" ")[0]} will reply by email, usually within a day.</p>
        </div>
      ) : (
        <Form {...form}>
          <form
            noValidate
            className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6"
            onSubmit={form.handleSubmit(async (v) => {
              setError(undefined);
              try {
                await sendContactMessage(slug, v);
                setSent(true);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't send.");
              }
            })}
          >
            <FormError message={error} />
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="order" render={({ field }) => (<FormItem><FormLabel>Order number (optional)</FormLabel><FormControl><Input className="font-mono uppercase" placeholder="PP-1081" {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="message" render={({ field }) => (<FormItem><FormLabel>Message</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={form.formState.isSubmitting} className="self-start">
              {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Send message
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
