"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileText, Loader2, Mail, RotateCcw } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { ReviewForm } from "@/components/buyer/review-form";
import { MoneyText } from "@/components/pp/money-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gtagEvent, loadTags, readConsent } from "@/lib/analytics-tags";
import { getPublicOrder } from "@/lib/api";
import { formatBytes } from "@/lib/money";
import type { OrderView } from "@/lib/server/order-types";
import type { CurrencyCode } from "@/lib/types";

const cur = (c: string): CurrencyCode => c as CurrencyCode;

export type OrderState = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; order: OrderView };

/** Loads a buyer's order by its secret link token */
export function useOrder(token: string | null): OrderState & { reload: () => void } {
  const [s, setS] = useState<OrderState>({ state: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    getPublicOrder(token)
      .then((order) => alive && setS({ state: "ready", order }))
      .catch((e) => alive && setS({ state: "error", message: e instanceof Error ? e.message : "We couldn't load your order." }));
    return () => {
      alive = false;
    };
  }, [token, tick]);
  const reload = () => setTick((n) => n + 1);
  if (!token) return { state: "error", message: "This link is missing its key. Look your order up with your email and order number.", reload };
  return { ...s, reload };
}

/** The thank-you / order page: what was bought, the files to download, the receipt */
export function OrderPage({ token, justPaid = false }: { token: string | null; justPaid?: boolean }) {
  const o = useOrder(token);
  if (o.state === "loading")
    return (
      <BuyerShell narrow>
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading your order"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full rounded-card" /><Skeleton className="h-24 w-full rounded-card" /></div>
      </BuyerShell>
    );
  if (o.state === "error")
    return (
      <BuyerShell narrow>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <h1 className="text-[1.75rem]">We can&apos;t open that order.</h1>
          <p className="max-w-sm text-muted-foreground">{o.message}</p>
          <div className="mt-2 flex gap-2">
            <Button asChild><Link href="/lookup">Find my order</Link></Button>
            <Button variant="secondary" onClick={o.reload}>Try again</Button>
          </div>
        </div>
      </BuyerShell>
    );
  const order = o.order;
  const c = cur(order.currency);
  return (
    <>
      {justPaid && <ReportPurchase order={order} />}
      <OrderBody order={order} token={token} justPaid={justPaid} c={c} reload={o.reload} state={o.state} />
    </>
  );
}

/** Tells Google Analytics about the sale, if the store has it and the visitor agreed on the store */
function ReportPurchase({ order }: { order: OrderView }) {
  useEffect(() => {
    if (order.status !== "paid" || !order.analytics?.ga4Id || readConsent(order.storeId) !== "yes") return;
    const key = `pp:purchase-sent:${order.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: may be sent twice on reload, which Google de-duplicates by transaction_id */
    }
    loadTags(order.analytics);
    gtagEvent("purchase", { transaction_id: order.ref, currency: order.currency, value: order.total / 100, tax: order.tax / 100, items: order.lines.map((l) => ({ item_name: l.title, price: l.total / 100 })) });
  }, [order]);
  return null;
}

function OrderBody({ order, token, justPaid, c, reload, state }: { order: OrderView; token: string | null; justPaid: boolean; c: CurrencyCode; reload: () => void; state: string }) {
  return (
    <BuyerShell narrow>
      <title>{`Order ${order.ref}`}</title>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          {justPaid && <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="size-5" aria-hidden /> Payment received</p>}
          <h1 className="text-[1.75rem]">{justPaid ? `Thank you, ${order.buyerName.split(" ")[0]}!` : `Order ${order.ref}`}</h1>
          <p className="text-muted-foreground">
            {order.storeName} · {order.ref}
            {justPaid && <> · We&apos;ve emailed your receipt to {order.buyerEmail} (if it&apos;s missing, check spam).</>}
          </p>
        </header>

        {order.files.length > 0 ? (
          <section aria-labelledby="dl-h" className="rounded-card border bg-surface p-5">
            <h2 id="dl-h" className="font-sans text-base font-semibold tracking-normal">Your files</h2>
            <ul className="mt-3 flex flex-col divide-y">
              {order.files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-3">
                  <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{f.name}</span><span className="block truncate text-xs text-muted-foreground">{f.product} · {formatBytes(f.size)}</span></span>
                  <Button asChild size="sm"><a href={`/api/download?t=${token}&f=${f.id}`}><Download aria-hidden /> Download</a></Button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">This page works for 30 days. Each link is private; keep it to yourself.</p>
          </section>
        ) : order.status === "paid" ? (
          <section className="rounded-card border bg-surface p-5"><p className="text-sm text-muted-foreground">There are no files to download with this order. The seller will be in touch about delivery{order.supportEmail ? <> at <a className="underline underline-offset-4" href={`mailto:${order.supportEmail}`}>{order.supportEmail}</a></> : ""}.</p></section>
        ) : (
          <section className="rounded-card border bg-surface p-5"><p className="flex items-center gap-2 text-sm"><RotateCcw className="size-4" aria-hidden /> This order is {order.status}. {order.status === "refunded" ? "Your money has been sent back and the files are no longer available." : ""}</p></section>
        )}

        <section aria-labelledby="sum-h" className="rounded-card border bg-surface p-5">
          <h2 id="sum-h" className="font-sans text-base font-semibold tracking-normal">Receipt</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {order.lines.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{l.title}{l.gift && <span className="ml-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">Free gift</span>}</span>
                <span className="flex shrink-0 items-baseline gap-2">{l.discount > 0 && <MoneyText value={{ amount: l.unit, currency: c }} className="text-xs text-muted-foreground line-through" />}<MoneyText value={{ amount: l.total, currency: c }} /></span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
            {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Savings</dt><dd>−<MoneyText value={{ amount: order.discount, currency: c }} /></dd></div>}
            {order.tax > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">GST included</dt><dd><MoneyText value={{ amount: order.tax, currency: c }} /></dd></div>}
            <div className="flex justify-between text-base font-semibold"><dt>Total paid</dt><dd><MoneyText value={{ amount: order.total, currency: c }} /></dd></div>
          </dl>
          {order.status === "paid" && (
            <Button asChild variant="secondary" size="sm" className="mt-4"><Link href={`/invoice/${order.id}?t=${token}`}><FileText aria-hidden /> View the tax invoice</Link></Button>
          )}
        </section>

        {order.status === "paid" && token && order.lines.some((l) => l.productId && !l.gift) && (
          <section aria-labelledby="rv-h" className="rounded-card border bg-surface p-5">
            <h2 id="rv-h" className="font-sans text-base font-semibold tracking-normal">How was it?</h2>
            <p className="text-sm text-muted-foreground">Your review helps the next buyer. It shows on the product as a verified purchase.</p>
            <ul className="mt-2 flex flex-col divide-y">
              {order.lines.filter((l) => l.productId && !l.gift).map((l) => <ReviewForm key={l.productId} token={token} productId={l.productId!} title={l.title} done={order.reviewed.includes(l.productId!)} />)}
            </ul>
          </section>
        )}

        <p className="flex items-start gap-2 text-sm text-muted-foreground"><Mail className="mt-0.5 size-4 shrink-0" aria-hidden /> Need help? {order.supportEmail ? <>Write to <a className="underline underline-offset-4" href={`mailto:${order.supportEmail}`}>{order.supportEmail}</a> and quote {order.ref}.</> : <>Quote {order.ref} when you contact the seller.</>}</p>
        {state === "ready" && order.status === "pending" && <p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" aria-hidden /> Waiting for the bank to confirm. <button type="button" className="underline underline-offset-4" onClick={reload}>Check again</button></p>}
      </div>
    </BuyerShell>
  );
}
