"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/auth/auth-card";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Faq } from "@/components/marketing/faq";
import { MoneyText } from "@/components/pp/money-text";
import { StatusPill } from "@/components/pp/status-pill";
import { lookupOrders } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";

const schema = z.object({
  email: z.string().min(1, "Enter the email you used at checkout.").email("That email looks off. Check for typos."),
  number: z.string().trim().regex(/^$|^PP-\d{3,6}$/i, "Order numbers look like PP-1081."),
});

const HELP: [string, string][] = [
  ["I paid but didn't get the email.", "Look in Spam and Promotions first. Then find your order here with the same email; the download page works without the email."],
  ["The file won't open.", "Try another device or app first (PDFs open best in a browser). If it's still broken, ask for a refund from your download page."],
  ["How do refunds work?", "Each creator sets a refund window, shown on the product and your receipt. Ask from the download page; the creator decides and the money returns to your card or UPI in 5 to 7 working days."],
  ["I was charged twice.", "The second charge usually reverses on its own within 48 hours. If not, ask for a refund on the duplicate order."],
];

export default function LookupPage() {
  const [results, setResults] = useState<Order[] | null>(null);
  const [error, setError] = useState<string>();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "", number: "" }, mode: "onTouched" });

  return (
    <BuyerShell narrow>
      <title>Find my order</title>
      <h1 className="text-[32px] leading-tight">Find my order</h1>
      <p className="mt-2 text-muted-foreground">Lost the email? Enter the address you paid with and we&apos;ll show your downloads.</p>
      <Form {...form}>
        <form
          noValidate
          className="mt-6 flex flex-col gap-4 rounded-card border bg-surface p-5"
          onSubmit={form.handleSubmit(async (v) => {
            setError(undefined);
            try {
              setResults(await lookupOrders(v.email, v.number || undefined));
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
            <FormItem><FormLabel>Order number (optional)</FormLabel><FormControl><Input className="font-mono uppercase" placeholder="PP-1081" {...field} /></FormControl><FormDescription>Leave blank to see everything you&apos;ve bought.</FormDescription><FormMessage /></FormItem>
          )} />
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Find my orders
          </Button>
        </form>
      </Form>

      <div aria-live="polite">
        {results && results.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden />
            <p className="font-semibold">No orders for that email.</p>
            <p className="text-sm text-muted-foreground">Check for typos, or try another address you use. In this demo, try priya.sharma@yahoo.in.</p>
          </div>
        )}
        {results && results.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2">
            {results.map((o) => (
              <li key={o.id}>
                <Link href={`/download/${o.id}`} className="flex items-center gap-3 rounded-card border bg-surface p-4 hover:border-border-strong">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.productTitle}</span>
                    <span className="block text-sm text-muted-foreground">{o.number} · {formatDate(o.paidAt ?? o.createdAt)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <MoneyText value={o.buyerTotal} className="text-sm font-semibold" />
                    {o.status !== "paid" && <StatusPill status={o.status} />}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
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
