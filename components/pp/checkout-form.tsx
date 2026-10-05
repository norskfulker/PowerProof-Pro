"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, Download, Landmark, Loader2, Lock, Smartphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Money, Order } from "@/lib/types";
import { MoneyText } from "./money-text";

export const DIAL_CODES = [
  { code: "+91", country: "India", min: 10, max: 10 },
  { code: "+1", country: "US / Canada", min: 10, max: 10 },
  { code: "+44", country: "UK", min: 10, max: 10 },
  { code: "+971", country: "UAE", min: 8, max: 9 },
  { code: "+65", country: "Singapore", min: 8, max: 8 },
  { code: "+61", country: "Australia", min: 9, max: 9 },
  { code: "+49", country: "Germany", min: 7, max: 12 },
];

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name for the receipt."),
    email: z.string().min(1, "We need an email to send your files to.").email("That email looks off. Check for typos."),
    dial: z.string(),
    phone: z.string().min(1, "Enter your phone number, in case a payment gets stuck.").regex(/^\d+$/, "Use digits only."),
    method: z.enum(["upi", "card", "netbanking", "wallet"]),
    consent: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.consent) ctx.addIssue({ path: ["consent"], code: "custom", message: "Please accept the terms and refund policy to continue." });
    const rule = DIAL_CODES.find((d) => d.code === v.dial)!;
    if (v.phone.length < rule.min || v.phone.length > rule.max) {
      ctx.addIssue({ path: ["phone"], code: "custom", message: rule.min === rule.max ? `${rule.country} numbers are ${rule.min} digits.` : `${rule.country} numbers are ${rule.min} to ${rule.max} digits.` });
    } else if (v.dial === "+91" && !/^[6-9]/.test(v.phone)) {
      ctx.addIssue({ path: ["phone"], code: "custom", message: "Indian mobile numbers start with 6, 7, 8 or 9." });
    }
  });

export type CheckoutValues = z.infer<typeof schema>;

const METHODS_IN = [
  { id: "upi", label: "UPI", icon: Smartphone, hint: "GPay, PhonePe, Paytm" },
  { id: "card", label: "Card", icon: CreditCard, hint: "Debit or credit" },
  { id: "netbanking", label: "Netbanking", icon: Landmark, hint: "All major banks" },
  { id: "wallet", label: "Wallet", icon: Wallet, hint: "Paytm, Amazon Pay" },
] as const;

export const CHECKOUT_FORM_ID = "checkout-form";

/** The Pay button's label and icon. Zero totals skip the gateway: "Get it now". */
export function PayLabel({ total, pending }: { total: Money; pending?: boolean }) {
  const free = total.amount === 0;
  return (
    <>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : free ? <Download aria-hidden /> : <Lock aria-hidden />}
      {free ? "Get it now" : <>Pay <MoneyText value={total} /></>}
    </>
  );
}

/**
 * Guest checkout: name, email, phone, coupon slot, payment method, consent, exact-total Pay button.
 * On phones the Pay button lives in a fixed bar (MobilePayBar) so it never moves while deals change the page.
 */
export function CheckoutForm({
  international,
  total,
  couponSlot,
  termsHref,
  refundHref,
  onPay,
  pending: externalPending,
}: {
  pending?: boolean;
  international: boolean;
  total: Money;
  couponSlot?: React.ReactNode;
  termsHref: string;
  refundHref: string;
  onPay: (v: CheckoutValues) => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", dial: international ? "+1" : "+91", phone: "", method: international ? "card" : "upi", consent: false },
    mode: "onTouched",
  });
  const dial = useWatch({ control: form.control, name: "dial" });
  const methods = international ? [{ id: "card", label: "International card", icon: CreditCard, hint: "Visa, Mastercard, Amex" } as const] : METHODS_IN;

  return (
    <Form {...form}>
      <form
        id={CHECKOUT_FORM_ID}
        noValidate
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(async (v) => {
          setPending(true);
          try {
            await onPay(schema.parse(v));
          } finally {
            setPending(false);
          }
        })}
      >
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Full name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" inputMode="email" autoComplete="email" {...field} /></FormControl><p className="text-xs text-muted-foreground">Your files and receipt go here. No account needed.</p><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Phone number</FormLabel>
            <div className="flex gap-2">
              <Select value={dial} onValueChange={(v) => form.setValue("dial", v, { shouldValidate: form.formState.isSubmitted })}>
                <SelectTrigger className="w-[104px] shrink-0 font-mono" aria-label="Country code"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIAL_CODES.map((d) => <SelectItem key={d.code} value={d.code}><span className="font-mono">{d.code}</span> {d.country}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormControl>
                <Input type="tel" inputMode="numeric" autoComplete="tel-national" {...field} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))} />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )} />

        {couponSlot}

        {total.amount > 0 && <FormField control={form.control} name="method" render={({ field }) => (
          <FormItem>
            <FormLabel>Pay with</FormLabel>
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Payment method">
              {methods.map((m) => (
                <label key={m.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-control border bg-surface px-3.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
                  <RadioGroupItem value={m.id} />
                  <m.icon className="size-5 text-primary" aria-hidden />
                  <span className="min-w-0"><span className="block text-sm font-semibold">{m.label}</span><span className="block text-xs text-muted-foreground">{m.hint}</span></span>
                </label>
              ))}
            </RadioGroup>
            {international && <p className="text-xs text-muted-foreground">UPI, netbanking and wallets work with Indian accounts only.</p>}
          </FormItem>
        )} />}
        {total.amount === 0 && <p className="rounded-control bg-primary-soft px-3.5 py-3 text-sm">Nothing to pay. Your files are delivered as soon as you confirm.</p>}

        <FormField control={form.control} name="consent" render={({ field }) => (
          <FormItem>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <FormControl><Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} className="mt-0.5" aria-label="I agree to the terms and refund policy" /></FormControl>
              <span>
                I agree to the <a href={termsHref} target="_blank" className="font-medium underline underline-offset-4">terms</a> and the{" "}
                <a href={refundHref} target="_blank" className="font-medium underline underline-offset-4">refund policy</a>, and understand files are delivered instantly.
              </span>
            </label>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" size="lg" disabled={pending || externalPending} className="w-full max-lg:hidden">
          <PayLabel total={total} pending={pending || externalPending} />
        </Button>
      </form>
    </Form>
  );
}

export type PaymentMethod = Order["paymentMethod"];
