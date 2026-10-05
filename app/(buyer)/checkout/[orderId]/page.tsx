"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CreditCard, Landmark, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormError } from "@/components/auth/auth-card";
import { BuyerShell, ConversionNote, TrustBar } from "@/components/buyer/buyer-shell";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { MockGateway } from "@/components/buyer/mock-gateway";
import { MoneyText } from "@/components/pp/money-text";
import { ProductImageView } from "@/components/pp/product-cover";
import { useApi } from "@/hooks/use-api";
import { getDelivery, payOrder } from "@/lib/api";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().min(1, "We need an email to send your file to.").email("That email looks off. Check for typos."),
  name: z.string().trim().min(2, "Enter your name for the receipt."),
});

export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const { data, error, reload } = useApi(() => getDelivery(orderId), [orderId]);
  const [method, setMethod] = useState<Order["paymentMethod"]>("upi");
  const [gateway, setGateway] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string>();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "", name: "" }, mode: "onTouched" });

  const paid = data?.order.status === "paid";
  useEffect(() => {
    if (paid) router.replace(`/success/${orderId}`);
  }, [paid, orderId, router]);

  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="order" />;
  const { order, product, store } = data;
  const intl = order.buyerTotal.currency !== "INR";
  const methods: { id: Order["paymentMethod"]; label: string; icon: React.ComponentType<{ className?: string }> }[] = intl
    ? [{ id: "card", label: "Card", icon: CreditCard }]
    : [
        { id: "upi", label: "UPI", icon: Smartphone },
        { id: "card", label: "Card", icon: CreditCard },
        { id: "netbanking", label: "Netbanking", icon: Landmark },
      ];
  const activeMethod = methods.some((m) => m.id === method) ? method : methods[0].id;

  async function pay(fail: boolean) {
    const v = form.getValues();
    setPaying(true);
    setPayError(undefined);
    try {
      await payOrder({ orderId, name: v.name, email: v.email, method: activeMethod, simulateFailure: fail });
      router.push(`/success/${orderId}`);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "The payment didn't go through.");
      setGateway(false);
      setPaying(false);
    }
  }

  return (
    <BuyerShell store={store} narrow>
      <title>{`Checkout · ${product.title}`}</title>
      <Link href={`/s/${store.slug}/${product.slug}`} className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to product
      </Link>
      <h1 className="text-[28px]">Checkout</h1>

      <section aria-label="Order summary" className="mt-5 flex gap-4 rounded-card border bg-surface p-4">
        <ProductImageView image={product.images[0]} size="xs" className="w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{product.title}</p>
          <p className="text-sm text-muted-foreground">Instant download · {store.name}</p>
        </div>
        <div className="text-right">
          <MoneyText value={order.buyerTotal} className="font-display text-xl" />
          {intl && <p className="font-mono text-[11px] text-muted-foreground">≈ <MoneyText value={order.total} /></p>}
        </div>
      </section>
      {intl && <ConversionNote currency={order.buyerTotal.currency} className="mt-2" />}

      <Form {...form}>
        <form noValidate className="mt-6 flex flex-col gap-5" onSubmit={form.handleSubmit(() => setGateway(true))}>
          <FormError message={payError} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" inputMode="email" autoComplete="email" {...field} /></FormControl>
              <FormDescription>Your file and receipt go here. No account needed.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl><Input autoComplete="name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Pay with</legend>
            <RadioGroup
              value={activeMethod}
              onValueChange={(v) => setMethod(v as Order["paymentMethod"])}
              className={cn("grid gap-2", methods.length > 1 ? "grid-cols-3" : "grid-cols-1")}
              aria-label="Payment method"
            >
              {methods.map((m) => (
                <label
                  key={m.id}
                  className="relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border bg-surface text-sm font-medium hover:border-border-strong has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft has-[[data-state=checked]]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                >
                  <RadioGroupItem value={m.id} className="sr-only" />
                  <m.icon className="size-5" aria-hidden /> {m.label}
                </label>
              ))}
            </RadioGroup>
            {intl && <p className="mt-2 text-xs text-muted-foreground">International buyers pay by card. UPI and netbanking are for Indian accounts.</p>}
          </fieldset>
          <Button type="submit" size="lg" className="w-full">
            <Lock aria-hidden /> Pay <MoneyText value={order.buyerTotal} />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By paying you accept {store.name}&apos;s refund policy: {store.refundDays ? `${store.refundDays} days` : "no refunds"}. Prices include any GST that applies.
          </p>
        </form>
      </Form>
      <TrustBar refundDays={store.refundDays} className="mt-6" />

      <MockGateway open={gateway} onOpenChange={setGateway} amount={order.buyerTotal} method={activeMethod} pending={paying} onApprove={() => pay(false)} onDecline={() => pay(true)} />
    </BuyerShell>
  );
}
