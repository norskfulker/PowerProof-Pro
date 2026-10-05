"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/auth/auth-card";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Faq } from "@/components/marketing/faq";
import { lookupOrder } from "@/lib/api";

const schema = z.object({
  email: z.string().min(1, "Enter the email you used at checkout.").email("That email looks off. Check for typos."),
  number: z.string().trim().min(1, "Enter your order number.").regex(/^PP-\d{3,6}$/i, "Order numbers look like PP-1081."),
});

const HELP: [string, string][] = [
  ["I paid but didn't get the email.", "Look in Spam and Promotions first. Then enter your email and order number here and we'll send a fresh link."],
  ["The file won't open.", "Try another device or app first (PDFs open best in a browser). If it's still broken, ask for a refund from your order page."],
  ["How do refunds work?", "Each creator sets a refund window, shown on the product and your receipt. Ask from your order page; the creator decides and the money returns to your card or UPI in 5 to 7 working days."],
  ["I was charged twice.", "The second charge usually reverses on its own within 48 hours. If not, ask for a refund on the duplicate order."],
];

export default function LookupPage() {
  const [result, setResult] = useState<{ sentTo: string; demoToken?: string } | null>(null);
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "", number: "" }, mode: "onTouched" });

  return (
    <BuyerShell narrow>
      <title>Find my order</title>
      <h1 className="text-[2rem] leading-tight">Find my order</h1>
      <p className="mt-2 text-muted-foreground">Lost the email? Enter the address you paid with and your order number. We&apos;ll email you a fresh link to your files.</p>
      <Form {...form}>
        <form
          noValidate
          className="mt-6 flex flex-col gap-4 rounded-card border bg-surface p-5"
          onSubmit={form.handleSubmit(async (v) => {
            setError(undefined);
            try {
              setResult(await lookupOrder(v.email, v.number));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          })}
        >
          <FormError message={error} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" inputMode="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="number" render={({ field }) => (
            <FormItem><FormLabel>Order number</FormLabel><FormControl><Input className="font-mono uppercase" placeholder="PP-1081" {...field} /></FormControl><FormDescription>It&apos;s on your receipt and in the email subject.</FormDescription><FormMessage /></FormItem>
          )} />
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Email me a fresh link
          </Button>
        </form>
      </Form>

      <div aria-live="polite">
        {result && (
          <div className="mt-6 flex flex-col items-start gap-3 rounded-card border bg-surface p-5" role="status">
            <MailCheck className="size-6 text-success" aria-hidden />
            <p className="font-semibold">Check your inbox.</p>
            <p className="text-sm text-muted-foreground">
              If <strong className="text-foreground">{result.sentTo}</strong> bought that order, a fresh link is on its way. It works for 24 hours. Nothing after five minutes? Check Spam, or the order number.
            </p>
            {result.demoToken && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/order/${result.demoToken}`}>Open the link (demo) <ArrowRight aria-hidden /></Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <section id="help" aria-labelledby="help-h" className="mt-12 scroll-mt-20">
        <h2 id="help-h" className="mb-4 text-2xl">Refunds and support</h2>
        <Faq items={HELP} />
        <p className="mt-4 text-sm text-muted-foreground">Still stuck? Reply to your receipt email; it goes straight to the creator. For payment problems, write to help@powerproof.store.</p>
      </section>
    </BuyerShell>
  );
}
